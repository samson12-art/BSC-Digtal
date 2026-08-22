const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { createAuditLog } = require('../utils/helpers');
const { validate } = require('../middleware/validate');

router.get('/', authenticate, authorize('CEO', 'EXECUTIVE_MANAGER', 'DEPARTMENT_MANAGER', 'BOARD_MEMBER'), async (req, res) => {
  try {
    const { departmentId, role, search } = req.query;
    const where = {};
    if (departmentId) where.departmentId = departmentId;
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
    const roleOrder = ['BOARD_MEMBER', 'CEO', 'EXECUTIVE_MANAGER', 'DEPARTMENT_MANAGER', 'TEAM_LEADER', 'EMPLOYEE'];
    roleOrder.forEach(role => { hierarchy[role] = users.filter(u => u.role === role).map(({ password, ...rest }) => rest); });
    res.json(hierarchy);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authenticate, authorize('CEO', 'EXECUTIVE_MANAGER', 'DEPARTMENT_MANAGER', 'BOARD_MEMBER'), [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('role').isIn(['BOARD_MEMBER', 'CEO', 'EXECUTIVE_MANAGER', 'DEPARTMENT_MANAGER', 'TEAM_LEADER', 'EMPLOYEE']).withMessage('Valid role is required'),
  validate
], async (req, res) => {
  try {
    const { firstName, lastName, email, password, role, departmentId, managerId } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    const hashedPassword = await bcrypt.hash(password || 'Password123!', 12);
    const user = await prisma.user.create({
      data: { firstName, lastName, email, password: hashedPassword, role, departmentId, managerId },
      include: { department: true }
    });
    await createAuditLog(req.user.id, `${req.user.firstName} ${req.user.lastName}`, 'CREATE_USER', 'User', user.id, { email, role });
    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json(userWithoutPassword);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authenticate, authorize('CEO', 'EXECUTIVE_MANAGER', 'DEPARTMENT_MANAGER', 'BOARD_MEMBER'), [
  body('firstName').optional().trim().notEmpty(),
  body('lastName').optional().trim().notEmpty(),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('role').optional().isIn(['BOARD_MEMBER', 'CEO', 'EXECUTIVE_MANAGER', 'DEPARTMENT_MANAGER', 'TEAM_LEADER', 'EMPLOYEE']),
  validate
], async (req, res) => {
  try {
    const { firstName, lastName, email, role, departmentId, managerId, isActive } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { firstName, lastName, email, role, departmentId, managerId, isActive },
      include: { department: true }
    });
    await createAuditLog(req.user.id, `${req.user.firstName} ${req.user.lastName}`, 'UPDATE_USER', 'User', user.id, req.body);
    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/my-team', authenticate, authorize('TEAM_LEADER', 'DEPARTMENT_MANAGER', 'EXECUTIVE_MANAGER', 'CEO'), async (req, res) => {
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
