const express = require('express');
const { body } = require('express-validator');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createAuditLog } = require('../utils/helpers');

const router = express.Router();

async function isDepartmentInScope(actor, departmentId) {
  return actor.role === 'CEO' || (actor.role === 'EXECUTIVE_MANAGER' && actor.departmentId === departmentId);
}

router.get('/', authenticate, async (req, res) => {
  try {
    const { departmentId } = req.query;
    const where = {};
    if (departmentId) where.departmentId = departmentId;
    if (['EXECUTIVE_MANAGER', 'DEPARTMENT_MANAGER', 'DIVISION_MANAGER'].includes(req.user.role)) {
      where.departmentId = req.user.departmentId || '__no_department_assigned__';
    }
    const divisions = await prisma.division.findMany({
      where,
      include: { department: { select: { id: true, name: true } }, _count: { select: { employees: true } } },
      orderBy: [{ department: { name: 'asc' } }, { name: 'asc' }]
    });
    res.json(divisions);
  } catch (error) {
    console.error('Get divisions error:', error);
    res.status(500).json({ error: 'Unable to load divisions' });
  }
});

router.post('/', authenticate, authorize('CEO', 'EXECUTIVE_MANAGER'), [
  body('name').trim().notEmpty().withMessage('Division name is required').isLength({ max: 100 }),
  body('departmentId').isUUID().withMessage('Department is required'),
  body('description').optional().trim().isLength({ max: 500 }),
  validate
], async (req, res) => {
  try {
    const { name, description, departmentId } = req.body;
    if (!(await isDepartmentInScope(req.user, departmentId))) {
      return res.status(403).json({ error: 'You can only create divisions in your assigned department.' });
    }
    const department = await prisma.department.findUnique({ where: { id: departmentId }, select: { id: true } });
    if (!department) return res.status(400).json({ error: 'Selected department does not exist.' });
    const division = await prisma.division.create({ data: { name, description, departmentId }, include: { department: true } });
    await createAuditLog(req.user.id, `${req.user.firstName} ${req.user.lastName}`, 'CREATE_DIVISION', 'Division', division.id, { name, departmentId });
    res.status(201).json(division);
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ error: 'A division with this name already exists in the department.' });
    console.error('Create division error:', error);
    res.status(500).json({ error: 'Unable to create division' });
  }
});

router.put('/:id', authenticate, authorize('CEO', 'EXECUTIVE_MANAGER'), [
  body('name').optional().trim().notEmpty().isLength({ max: 100 }),
  body('description').optional().trim().isLength({ max: 500 }),
  validate
], async (req, res) => {
  try {
    const existing = await prisma.division.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Division not found' });
    if (!(await isDepartmentInScope(req.user, existing.departmentId))) {
      return res.status(403).json({ error: 'You can only manage divisions in your assigned department.' });
    }
    const division = await prisma.division.update({ where: { id: existing.id }, data: { name: req.body.name, description: req.body.description }, include: { department: true } });
    await createAuditLog(req.user.id, `${req.user.firstName} ${req.user.lastName}`, 'UPDATE_DIVISION', 'Division', division.id, req.body);
    res.json(division);
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ error: 'A division with this name already exists in the department.' });
    res.status(500).json({ error: 'Unable to update division' });
  }
});

module.exports = router;
