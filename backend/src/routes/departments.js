const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { createAuditLog } = require('../utils/helpers');
const { validate } = require('../middleware/validate');

router.get('/', authenticate, async (req, res) => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        _count: { select: { employees: true, bscPlans: true } }
      },
      orderBy: { name: 'asc' }
    });
    res.json(departments);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const department = await prisma.department.findUnique({
      where: { id: req.params.id },
      include: {
        employees: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        _count: { select: { bscPlans: true } }
      }
    });
    if (!department) return res.status(404).json({ error: 'Department not found' });
    res.json(department);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authenticate, authorize('CEO', 'EXECUTIVE_MANAGER', 'BOARD_MEMBER'), [
  body('name').trim().notEmpty().withMessage('Department name is required').isLength({ max: 100 }),
  body('description').optional().trim().isLength({ max: 500 }),
  validate
], async (req, res) => {
  try {
    const { name, description } = req.body;
    const department = await prisma.department.create({ data: { name, description } });
    await createAuditLog(req.user.id, `${req.user.firstName} ${req.user.lastName}`, 'CREATE_DEPARTMENT', 'Department', department.id, { name });
    res.status(201).json(department);
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ error: 'Department name already exists' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authenticate, authorize('CEO', 'EXECUTIVE_MANAGER', 'BOARD_MEMBER'), [
  body('name').optional().trim().notEmpty().isLength({ max: 100 }),
  body('description').optional().trim().isLength({ max: 500 }),
  validate
], async (req, res) => {
  try {
    const { name, description } = req.body;
    const department = await prisma.department.update({
      where: { id: req.params.id },
      data: { name, description }
    });
    res.json(department);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
