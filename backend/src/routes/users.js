const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { createAuditLog } = require('../utils/helpers');
const { validate } = require('../middleware/validate');
const { sendVerificationEmail } = require('../utils/email');
const { normalizePhone, sendSMS } = require('../utils/sms');
const crypto = require('crypto');

const createVerificationToken = () => crypto.randomBytes(32).toString('hex');
const hashVerificationToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const managedRoles = {
  CEO: new Set(['BOARD_MEMBER', 'CEO', 'EXECUTIVE_MANAGER', 'DEPARTMENT_MANAGER', 'EMPLOYEE']),
  EXECUTIVE_MANAGER: new Set(['DEPARTMENT_MANAGER', 'EMPLOYEE']),
  DEPARTMENT_MANAGER: new Set(['EMPLOYEE'])
};

function canManageUser(actor, role, departmentId) {
  if (!managedRoles[actor.role]?.has(role)) return false;
  return actor.role === 'CEO' || (Boolean(actor.departmentId) && departmentId === actor.departmentId);
}

async function validateManagerScope(actor, managerId, departmentId) {
  if (!managerId || actor.role === 'CEO') return null;
  const manager = await prisma.user.findUnique({ where: { id: managerId }, select: { departmentId: true } });
  if (!manager || manager.departmentId !== departmentId) {
    return 'Reports-to manager must belong to your department.';
  }
  return null;
}

router.get('/', authenticate, authorize('CEO', 'EXECUTIVE_MANAGER', 'DEPARTMENT_MANAGER', 'BOARD_MEMBER'), async (req, res) => {
  try {
    const { departmentId, role, search } = req.query;
    const where = {};
    if (req.user.role === 'EXECUTIVE_MANAGER' || req.user.role === 'DEPARTMENT_MANAGER') {
      where.departmentId = req.user.departmentId || '__no_department_assigned__';
    } else if (departmentId) where.departmentId = departmentId;
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }
    const users = await prisma.user.findMany({
      where,
      include: { department: true, manager: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: [{ role: 'asc' }, { lastName: 'asc' }]
    });
    const sanitized = users.map(({ password, ...rest }) => rest);
    res.json(sanitized);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/hierarchy', authenticate, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      include: { department: true },
      orderBy: [{ role: 'asc' }, { lastName: 'asc' }]
    });
    const hierarchy = {};
    const roleOrder = ['BOARD_MEMBER', 'CEO', 'EXECUTIVE_MANAGER', 'DEPARTMENT_MANAGER', 'EMPLOYEE'];
    roleOrder.forEach(role => { hierarchy[role] = users.filter(u => u.role === role).map(({ password, ...rest }) => rest); });
    res.json(hierarchy);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authenticate, authorize('CEO', 'EXECUTIVE_MANAGER', 'DEPARTMENT_MANAGER'), [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('role').isIn(['BOARD_MEMBER', 'CEO', 'EXECUTIVE_MANAGER', 'DEPARTMENT_MANAGER', 'EMPLOYEE']).withMessage('Valid role is required'),
  validate
], async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone, role, departmentId, managerId } = req.body;
    if (!canManageUser(req.user, role, departmentId)) {
      return res.status(403).json({ error: 'You can only create permitted roles in your assigned department.' });
    }
    const managerScopeError = await validateManagerScope(req.user, managerId, departmentId);
    if (managerScopeError) return res.status(403).json({ error: managerScopeError });
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    let normalizedPhone = null;
    if (phone) {
      normalizedPhone = normalizePhone(phone);
      if (!normalizedPhone) {
        return res.status(400).json({ error: 'Enter a valid Ethiopian phone number, e.g. 0912345678.' });
      }
      const phoneTaken = await prisma.user.findUnique({ where: { phone: normalizedPhone } });
      if (phoneTaken) {
        return res.status(400).json({ error: 'Phone number is already linked to another account.' });
      }
    }
    const hashedPassword = await bcrypt.hash(password || 'Password123!', 12);
    const data = {
      firstName, lastName, email: email.toLowerCase(), password: hashedPassword,
      phone: normalizedPhone, role, departmentId, managerId
    };
    let verificationEmailToken = null;
    if (normalizedPhone) {
      data.emailVerifiedAt = new Date();
    } else {
      verificationEmailToken = createVerificationToken();
      data.emailVerificationToken = hashVerificationToken(verificationEmailToken);
      data.emailVerificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }
    const user = await prisma.user.create({ data, include: { department: true } });
    await createAuditLog(req.user.id, `${req.user.firstName} ${req.user.lastName}`, 'CREATE_USER', 'User', user.id, { email, role });
    let smsSent = false;
    if (normalizedPhone) {
      smsSent = Boolean(await sendSMS(normalizedPhone,
        `Hello ${firstName}, your BSC System account has been created. Sign in with ${email.toLowerCase()} using the password given to you by your administrator.`));
    } else {
      await sendVerificationEmail(user.email, user.firstName, verificationEmailToken);
    }
    const { password: _, ...userWithoutPassword } = { ...user, smsSent };
    res.status(201).json(userWithoutPassword);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authenticate, authorize('CEO', 'EXECUTIVE_MANAGER', 'DEPARTMENT_MANAGER'), [
  body('firstName').optional().trim().notEmpty(),
  body('lastName').optional().trim().notEmpty(),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('role').optional().isIn(['BOARD_MEMBER', 'CEO', 'EXECUTIVE_MANAGER', 'DEPARTMENT_MANAGER', 'EMPLOYEE']),
  validate
], async (req, res) => {
  try {
    const { firstName, lastName, email, phone, role, departmentId, managerId, isActive } = req.body;
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'User not found' });
    const nextRole = role || existing.role;
    const nextDepartmentId = departmentId === undefined ? existing.departmentId : departmentId;
    if (!canManageUser(req.user, existing.role, existing.departmentId) || !canManageUser(req.user, nextRole, nextDepartmentId)) {
      return res.status(403).json({ error: 'You can only manage permitted roles in your assigned department.' });
    }
    const managerScopeError = await validateManagerScope(req.user, managerId, nextDepartmentId);
    if (managerScopeError) return res.status(403).json({ error: managerScopeError });
    let normalizedPhone;
    if (phone !== undefined) {
      if (!phone) {
        normalizedPhone = null;
      } else {
        normalizedPhone = normalizePhone(phone);
        if (!normalizedPhone) {
          return res.status(400).json({ error: 'Enter a valid Ethiopian phone number, e.g. 0912345678.' });
        }
        if (normalizedPhone !== existing.phone) {
          const phoneTaken = await prisma.user.findFirst({ where: { phone: normalizedPhone, id: { not: req.params.id } } });
          if (phoneTaken) {
            return res.status(400).json({ error: 'Phone number is already linked to another account.' });
          }
        }
      }
    }
    const data = { firstName, lastName, email: email?.toLowerCase(), role, departmentId, managerId, isActive };
    if (phone !== undefined) {
      data.phone = normalizedPhone;
      if (normalizedPhone !== existing.phone && normalizedPhone !== null) data.phoneVerifiedAt = null;
    }
    let emailVerificationToken;
    if (email) {
      emailVerificationToken = createVerificationToken();
      data.emailVerifiedAt = null;
      data.emailVerificationToken = hashVerificationToken(emailVerificationToken);
      data.emailVerificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      include: { department: true }
    });
    if (email) await sendVerificationEmail(user.email, user.firstName, emailVerificationToken);
    await createAuditLog(req.user.id, `${req.user.firstName} ${req.user.lastName}`, 'UPDATE_USER', 'User', user.id, req.body);
    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/my-team', authenticate, authorize('DEPARTMENT_MANAGER', 'EXECUTIVE_MANAGER', 'CEO'), async (req, res) => {
  try {
    const team = await prisma.user.findMany({
      where: { managerId: req.user.id, isActive: true },
      include: { department: true }
    });
    const sanitized = team.map(({ password, ...rest }) => rest);
    res.json(sanitized);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/search', authenticate, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } }
        ]
      },
      select: { id: true, firstName: true, lastName: true, email: true, role: true, department: { select: { id: true, name: true } } },
      orderBy: [{ role: 'asc' }, { lastName: 'asc' }],
      take: 20
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
