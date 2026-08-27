const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body } = require('express-validator');
const prisma = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');
const { createAuditLog, createNotification } = require('../utils/helpers');
const { validate } = require('../middleware/validate');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');
const { normalizePhone, sendPhoneVerification, verifyPhoneCode } = require('../utils/sms');

const verificationToken = () => crypto.randomBytes(32).toString('hex');
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const frontendUrl = () => (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim();
const apiUrl = (req) => (process.env.API_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

const oauthConfig = (provider) => {
  const configs = {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      userUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
      scope: 'openid email profile'
    },
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      authorizationUrl: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || 'common'}/oauth2/v2.0/authorize`,
      tokenUrl: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || 'common'}/oauth2/v2.0/token`,
      userUrl: 'https://graph.microsoft.com/v1.0/me?$select=displayName,givenName,surname,mail,userPrincipalName',
      scope: 'openid profile email User.Read'
    }
  };
  return configs[provider];
};

const oauthError = (res, message) => res.redirect(`${frontendUrl()}/login?oauthError=${encodeURIComponent(message)}`);

router.get('/oauth/:provider', (req, res) => {
  const { provider } = req.params;
  const config = oauthConfig(provider);
  if (!config || !config.clientId || !config.clientSecret) return oauthError(res, `${provider === 'google' ? 'Google' : 'Microsoft'} sign-in is not configured.`);
  const redirectUri = `${apiUrl(req)}/api/auth/oauth/${provider}/callback`;
  const state = jwt.sign({ provider, type: 'oauth-state' }, process.env.JWT_SECRET, { expiresIn: '10m' });
  const params = new URLSearchParams({ client_id: config.clientId, redirect_uri: redirectUri, response_type: 'code', scope: config.scope, state });
  if (provider === 'google') params.set('access_type', 'online');
  res.redirect(`${config.authorizationUrl}?${params.toString()}`);
});

router.get('/oauth/:provider/callback', async (req, res) => {
  const { provider } = req.params;
  const config = oauthConfig(provider);
  if (!config || !config.clientId || !config.clientSecret) return oauthError(res, 'This sign-in provider is not configured.');
  try {
    const state = jwt.verify(req.query.state || '', process.env.JWT_SECRET);
    if (state.type !== 'oauth-state' || state.provider !== provider || !req.query.code) throw new Error('Invalid sign-in request');
    const redirectUri = `${apiUrl(req)}/api/auth/oauth/${provider}/callback`;
    const tokenResponse = await fetch(config.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, code: req.query.code, redirect_uri: redirectUri, grant_type: 'authorization_code' }) });
    if (!tokenResponse.ok) throw new Error('Provider token exchange failed');
    const { access_token: accessToken } = await tokenResponse.json();
    const profileResponse = await fetch(config.userUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!profileResponse.ok) throw new Error('Could not read your profile from the provider');
    const profile = await profileResponse.json();
    const email = (profile.email || profile.mail || profile.userPrincipalName || '').toLowerCase();
    if (!email) throw new Error('Your provider account does not have an email address');
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const fullName = profile.name || profile.displayName || `${profile.given_name || profile.givenName || ''} ${profile.family_name || profile.surname || ''}`.trim() || email.split('@')[0];
      const [firstName, ...lastNameParts] = fullName.trim().split(/\s+/);
      user = await prisma.user.create({ data: {
        firstName: firstName || 'Employee', lastName: lastNameParts.join(' ') || 'User', email,
        password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12), role: 'EMPLOYEE',
        emailVerifiedAt: new Date(), isApproved: false
      } });
      const ceos = await prisma.user.findMany({ where: { role: 'CEO', isActive: true, isApproved: true }, select: { id: true } });
      await Promise.all(ceos.map((ceo) => createNotification(
        ceo.id,
        'New employee approval required',
        `${user.firstName} ${user.lastName} registered with ${provider} and is awaiting approval.`,
        'ACCOUNT_APPROVAL',
        '/users'
      )));
    }
    if (!user.isActive) return oauthError(res, 'Your account is not authorized to access this system. Contact your administrator.');
    const code = jwt.sign({ userId: user.id, type: 'oauth-code' }, process.env.JWT_SECRET, { expiresIn: '60s' });
    res.redirect(`${frontendUrl()}/login?oauthCode=${encodeURIComponent(code)}`);
  } catch (error) {
    console.error(`${provider} OAuth error:`, error.message);
    return oauthError(res, 'Sign-in could not be completed. Please try again.');
  }
});

router.post('/oauth/exchange', [body('code').isString().notEmpty().withMessage('Sign-in code is required'), validate], async (req, res) => {
  try {
    const code = jwt.verify(req.body.code, process.env.JWT_SECRET);
    if (code.type !== 'oauth-code') return res.status(400).json({ error: 'Invalid sign-in code' });
    const user = await prisma.user.findUnique({ where: { id: code.userId }, include: { department: true, division: true, manager: true } });
    if (!user || !user.isActive) return res.status(401).json({ error: 'Your account is no longer active' });
    const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    await createAuditLog(user.id, `${user.firstName} ${user.lastName}`, 'LOGIN', 'User', user.id, { method: 'oauth' }, req.ip);
    const { password: _, ...userWithoutPassword } = user;
    res.json({ token, user: userWithoutPassword });
  } catch (error) {
    return res.status(400).json({ error: 'This sign-in link has expired. Please try again.' });
  }
});

router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  validate
], async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email }, include: { department: true, division: true, manager: true } });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!user.emailVerifiedAt) {
      return res.status(403).json({ error: 'Please verify your email address before signing in.' });
    }
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    await createAuditLog(user.id, `${user.firstName} ${user.lastName}`, 'LOGIN', 'User', user.id, null, req.ip);
    const { password: _, ...userWithoutPassword } = user;
    res.json({ token, user: userWithoutPassword });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/register', [
  body('firstName').trim().isLength({ min: 1, max: 80 }).withMessage('First name is required'),
  body('lastName').trim().isLength({ min: 1, max: 80 }).withMessage('Last name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('departmentId').isUUID().withMessage('Department is required'),
  body('position').trim().isLength({ min: 2, max: 100 }).withMessage('Position is required'),
  validate
], async (req, res) => {
  try {
    const { firstName, lastName, password, departmentId, position } = req.body;
    const email = req.body.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'An account already exists for this email. Please sign in.' });
    const phone = normalizePhone(req.body.phone);
    if (!phone) return res.status(400).json({ error: 'Enter a valid Ethiopian phone number, e.g. 0912345678.' });
    const [phoneTaken, department] = await Promise.all([
      prisma.user.findUnique({ where: { phone } }),
      prisma.department.findUnique({ where: { id: departmentId }, select: { id: true } })
    ]);
    if (phoneTaken) return res.status(409).json({ error: 'This phone number is already linked to another account.' });
    if (!department) return res.status(400).json({ error: 'Selected department does not exist.' });
    const user = await prisma.user.create({ data: {
      firstName: firstName.trim(), lastName: lastName.trim(), email, phone, position: position.trim(), departmentId,
      password: await bcrypt.hash(password, 12), role: 'EMPLOYEE', emailVerifiedAt: new Date(), isApproved: false
    } });
    await createAuditLog(user.id, `${user.firstName} ${user.lastName}`, 'REGISTER', 'User', user.id, { method: 'password' }, req.ip);
    const ceos = await prisma.user.findMany({ where: { role: 'CEO', isActive: true, isApproved: true }, select: { id: true } });
    await Promise.all(ceos.map((ceo) => createNotification(
      ceo.id,
      'New employee approval required',
      `${user.firstName} ${user.lastName} registered as ${user.position} and is awaiting approval.`,
      'ACCOUNT_APPROVAL',
      '/users'
    )));
    res.status(201).json({ message: 'Account created. It is awaiting administrator approval.' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Unable to create account' });
  }
});

router.get('/verify-email', async (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  if (!token) return res.status(400).json({ error: 'Verification token is required' });
  try {
    const user = await prisma.user.findFirst({ where: {
      emailVerificationToken: hashToken(token),
      emailVerificationExpiresAt: { gt: new Date() }
    } });
    if (!user) return res.status(400).json({ error: 'This verification link is invalid or has expired.' });
    await prisma.user.update({ where: { id: user.id }, data: {
      emailVerifiedAt: new Date(), emailVerificationToken: null, emailVerificationExpiresAt: null
    } });
    res.json({ message: 'Email verified successfully. You can now sign in.' });
  } catch (error) {
    res.status(500).json({ error: 'Unable to verify email' });
  }
});

router.post('/resend-verification', [body('email').isEmail().withMessage('Valid email is required'), validate], async (req, res) => {
  try {
    const email = req.body.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && user.isActive && !user.emailVerifiedAt) {
      const token = verificationToken();
      await prisma.user.update({ where: { id: user.id }, data: {
        emailVerificationToken: hashToken(token),
        emailVerificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      } });
      await sendVerificationEmail(user.email, user.firstName, token);
    }
    res.json({ message: 'If an unverified account exists, a verification email has been sent.' });
  } catch (error) {
    res.status(500).json({ error: 'Unable to send verification email' });
  }
});

// Always return the same response so an attacker cannot use this endpoint to
// discover which email addresses have accounts.
router.post('/forgot-password', [body('email').isEmail().withMessage('Valid email is required'), validate], async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { email: req.body.email.toLowerCase() } });
    if (user && user.isActive) {
      const token = verificationToken();
      await prisma.user.update({ where: { id: user.id }, data: {
        passwordResetToken: hashToken(token),
        passwordResetExpiresAt: new Date(Date.now() + 30 * 60 * 1000)
      } });
      await sendPasswordResetEmail(user.email, user.firstName, token);
      await createAuditLog(user.id, `${user.firstName} ${user.lastName}`, 'REQUEST_PASSWORD_RESET', 'User', user.id, null, req.ip);
    }
    res.json({ message: 'If an active account exists for this email, a password-reset link has been sent.' });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({ error: 'Unable to process password reset request' });
  }
});

router.post('/reset-password', [
  body('token').isString().notEmpty().withMessage('Reset token is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  validate
], async (req, res) => {
  try {
    const user = await prisma.user.findFirst({ where: {
      passwordResetToken: hashToken(req.body.token),
      passwordResetExpiresAt: { gt: new Date() }
    } });
    if (!user) return res.status(400).json({ error: 'This password-reset link is invalid or has expired.' });
    await prisma.user.update({ where: { id: user.id }, data: {
      password: await bcrypt.hash(req.body.newPassword, 12),
      passwordResetToken: null,
      passwordResetExpiresAt: null
    } });
    await createAuditLog(user.id, `${user.firstName} ${user.lastName}`, 'RESET_PASSWORD', 'User', user.id, null, req.ip);
    res.json({ message: 'Password reset successfully. You can now sign in.' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Unable to reset password' });
  }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { department: true, division: true, manager: { select: { id: true, firstName: true, lastName: true, role: true } } }
    });
    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/change-password', authenticate, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  validate
], async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: req.user.id }, data: { password: hashedPassword } });
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/phone/send', authenticate, [
  body('phone').notEmpty().withMessage('Phone number is required'),
  validate
], async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    if (!phone) {
      return res.status(400).json({ error: 'Enter a valid Ethiopian phone number, e.g. 0912345678.' });
    }
    const taken = await prisma.user.findFirst({ where: { phone, id: { not: req.user.id } } });
    if (taken) {
      return res.status(409).json({ error: 'This phone number is already linked to another account.' });
    }
    if (req.user.phone !== phone || !req.user.phoneVerifiedAt) {
      await prisma.user.update({ where: { id: req.user.id }, data: { phone, phoneVerifiedAt: null } });
    }
    const result = await sendPhoneVerification(phone);
    if (!result) {
      return res.status(502).json({ error: 'Unable to send the verification SMS right now. Please try again.' });
    }
    res.json({ message: `A verification code was sent to +${phone}.` });
  } catch (error) {
    console.error('Send phone verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/phone/verify', authenticate, [
  body('code').isLength({ min: 4, max: 8 }).withMessage('Verification code is required'),
  validate
], async (req, res) => {
  try {
    if (!req.user.phone) {
      return res.status(400).json({ error: 'No phone number is attached to your account.' });
    }
    const result = await verifyPhoneCode(req.user.phone, req.body.code);
    if (!result) {
      return res.status(400).json({ error: 'The code is invalid or has expired.' });
    }
    await prisma.user.update({ where: { id: req.user.id }, data: { phoneVerifiedAt: new Date() } });
    res.json({ message: 'Phone number verified successfully.' });
  } catch (error) {
    console.error('Verify phone error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
