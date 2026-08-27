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
  CEO: new Set(['BOARD_MEMBER', 'CEO', 'EXECUTIVE_MANAGER', 'DEPARTMENT_MANAGER', 'DIVISION_MANAGER', 'EMPLOYEE']),
  EXECUTIVE_MANAGER: new Set(['DEPARTMENT_MANAGER', 'DIVISION_MANAGER', 'EMPLOYEE']),
  DEPARTMENT_MANAGER: new Set(['DIVISION_MANAGER', 'EMPLOYEE']),
  DIVISION_MANAGER: new Set(['EMPLOYEE'])
};

function canManageUser(actor, role, departmentId, divisionId) {
  if (!managedRoles[actor.role]?.has(role)) return false;
  if (actor.role === 'CEO') return true;
  if (actor.role === 'DIVISION_MANAGER') {
    return Boolean(actor.departmentId && actor.divisionId) && departmentId === actor.departmentId && divisionId === actor.divisionId;
  }
  return Boolean(actor.departmentId) && departmentId === actor.departmentId;
}

async function validateManagerScope(actor, managerId, departmentId, divisionId) {
  if (!managerId || actor.role === 'CEO') return null;
  const manager = await prisma.user.findUnique({ where: { id: managerId }, select: { departmentId: true, divisionId: true } });
  if (!manager || manager.departmentId !== departmentId) {
    return 'Reports-to manager must belong to your department.';
  }
  if (actor.role === 'DIVISION_MANAGER' && manager.divisionId !== divisionId) {
    return 'Reports-to manager must belong to the same division.';
  }
  return null;
}

async function validateDivisionScope(divisionId, departmentId) {
  if (!divisionId) return null;
  if (!departmentId) return 'A division can only be assigned when a department is selected.';
  const division = await prisma.division.findUnique({ where: { id: divisionId }, select: { departmentId: true } });
  if (!division || division.departmentId !== departmentId) {
    return 'Selected division does not belong to the selected department.';
  }
  return null;
}

router.get('/', authenticate, authorize('CEO', 'EXECUTIVE_MANAGER', 'DEPARTMENT_MANAGER', 'DIVISION_MANAGER', 'BOARD_MEMBER'), async (req, res) => {
  try {
    const { departmentId, divisionId, role, search } = req.query;
    const where = {};
    if (['EXECUTIVE_MANAGER', 'DEPARTMENT_MANAGER', 'DIVISION_MANAGER'].includes(req.user.role)) {
      where.departmentId = req.user.departmentId || '__no_department_assigned__';
      if (req.user.role === 'DIVISION_MANAGER') where.divisionId = req.user.divisionId || '__no_division_assigned__';
    } else if (departmentId) where.departmentId = departmentId;
    if (divisionId) where.divisionId = divisionId;
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
      include: { department: true, division: true, manager: { select: { id: true, firstName: true, lastName: true } } },
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
    const roleOrder = ['BOARD_MEMBER', 'CEO', 'EXECUTIVE_MANAGER', 'DEPARTMENT_MANAGER', 'DIVISION_MANAGER', 'EMPLOYEE'];
    roleOrder.forEach(role => { hierarchy[role] = users.filter(u => u.role === role).map(({ password, ...rest }) => rest); });
    res.json(hierarchy);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authenticate, authorize('CEO', 'EXECUTIVE_MANAGER', 'DEPARTMENT_MANAGER', 'DIVISION_MANAGER'), [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('role').isIn(['BOARD_MEMBER', 'CEO', 'EXECUTIVE_MANAGER', 'DEPARTMENT_MANAGER', 'DIVISION_MANAGER', 'EMPLOYEE']).withMessage('Valid role is required'),
  validate
], async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone, role, departmentId, divisionId, managerId } = req.body;
    if (!canManageUser(req.user, role, departmentId, divisionId)) {
      return res.status(403).json({ error: 'You can only create permitted roles in your assigned department.' });
    }
    const managerScopeError = await validateManagerScope(req.user, managerId, departmentId, divisionId);
    if (managerScopeError) return res.status(403).json({ error: managerScopeError });
    const divisionScopeError = await validateDivisionScope(divisionId, departmentId);
    if (divisionScopeError) return res.status(400).json({ error: divisionScopeError });
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
      phone: normalizedPhone, role, departmentId, divisionId: divisionId || null, managerId
    };
    let verificationEmailToken = null;
    if (normalizedPhone) {
      data.emailVerifiedAt = new Date();
    } else {
      verificationEmailToken = createVerificationToken();
      data.emailVerificationToken = hashVerificationToken(verificationEmailToken);
      data.emailVerificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }
    const user = await prisma.user.create({ data, include: { department: true, division: true } });
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

router.put('/:id', authenticate, authorize('CEO', 'EXECUTIVE_MANAGER', 'DEPARTMENT_MANAGER', 'DIVISION_MANAGER'), [
  body('firstName').optional().trim().notEmpty(),
  body('lastName').optional().trim().notEmpty(),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('role').optional().isIn(['BOARD_MEMBER', 'CEO', 'EXECUTIVE_MANAGER', 'DEPARTMENT_MANAGER', 'DIVISION_MANAGER', 'EMPLOYEE']),
  validate
], async (req, res) => {
  try {
    const { firstName, lastName, email, phone, role, departmentId, divisionId, managerId, isActive, isApproved } = req.body;
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'User not found' });
    const nextRole = role || existing.role;
    const nextDepartmentId = departmentId === undefined ? existing.departmentId : departmentId;
    const nextDivisionId = divisionId === undefined ? existing.divisionId : divisionId;
    if (!canManageUser(req.user, existing.role, existing.departmentId, existing.divisionId) || !canManageUser(req.user, nextRole, nextDepartmentId, nextDivisionId)) {
      return res.status(403).json({ error: 'You can only manage permitted roles in your assigned department.' });
    }
    const managerScopeError = await validateManagerScope(req.user, managerId, nextDepartmentId, nextDivisionId);
    if (managerScopeError) return res.status(403).json({ error: managerScopeError });
    const divisionScopeError = await validateDivisionScope(nextDivisionId, nextDepartmentId);
    if (divisionScopeError) return res.status(400).json({ error: divisionScopeError });
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
    const data = { firstName, lastName, email: email?.toLowerCase(), role, departmentId, divisionId: divisionId === undefined ? undefined : divisionId || null, managerId, isActive, isApproved };
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
      include: { department: true, division: true }
    });
    if (email) await sendVerificationEmail(user.email, user.firstName, emailVerificationToken);
    await createAuditLog(req.user.id, `${req.user.firstName} ${req.user.lastName}`, 'UPDATE_USER', 'User', user.id, req.body);
    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User removal is a reversible deactivation, preserving audit and performance records.
router.delete('/:id', authenticate, authorize('CEO', 'EXECUTIVE_MANAGER', 'DEPARTMENT_MANAGER', 'DIVISION_MANAGER'), async (req, res) => {
  try {
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'User not found' });
    if (existing.id === req.user.id) return res.status(400).json({ error: 'You cannot remove your own account' });
    if (!canManageUser(req.user, existing.role, existing.departmentId, existing.divisionId)) return res.status(403).json({ error: 'You can only remove permitted users in your assigned department.' });
    await prisma.user.update({ where: { id: existing.id }, data: { isActive: false, isApproved: false } });
    await createAuditLog(req.user.id, `${req.user.firstName} ${req.user.lastName}`, 'REMOVE_USER', 'User', existing.id, { email: existing.email, role: existing.role });
    res.json({ message: 'User removed and deactivated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/my-team', authenticate, authorize('DIVISION_MANAGER', 'DEPARTMENT_MANAGER', 'EXECUTIVE_MANAGER', 'CEO'), async (req, res) => {
  try {
    const team = await prisma.user.findMany({
      where: { managerId: req.user.id, isActive: true },
      include: { department: true, division: true }
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
      select: { id: true, firstName: true, lastName: true, email: true, role: true, department: { select: { id: true, name: true } }, division: { select: { id: true, name: true } } },
      orderBy: [{ role: 'asc' }, { lastName: 'asc' }],
      take: 20
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
