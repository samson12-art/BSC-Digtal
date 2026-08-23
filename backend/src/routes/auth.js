const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body } = require('express-validator');
const prisma = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');
const { createAuditLog } = require('../utils/helpers');
const { validate } = require('../middleware/validate');
const { sendVerificationEmail } = require('../utils/email');

const verificationToken = () => crypto.randomBytes(32).toString('hex');
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  validate
], async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email }, include: { department: true, manager: true } });
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

router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { department: true, manager: { select: { id: true, firstName: true, lastName: true, role: true } } }
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

module.exports = router;
