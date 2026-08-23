const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { body } = require('express-validator');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { createAuditLog, createNotification } = require('../utils/helpers');
const { validate } = require('../middleware/validate');

const months = ['July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May', 'June'];

function normaliseMonthlyTargets(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const targets = {};
  months.forEach(month => {
    const number = Number(value[month]);
    if (Number.isFinite(number)) targets[month] = number;
  });
  return Object.keys(targets).length ? targets : null;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', authenticate, async (req, res) => {
  try {
    const { status, perspective, departmentId, ownerId, year } = req.query;
    const where = {};
    if (status) where.status = status;
    if (perspective) where.perspective = perspective;
    if (departmentId) where.departmentId = departmentId;
    if (ownerId) where.ownerId = ownerId;
    
    if (req.user.role === 'EMPLOYEE') {
      where.ownerId = req.user.id;
    } else if (req.user.role === 'DEPARTMENT_MANAGER') {
      where.OR = [
        { ownerId: req.user.id },
        { departmentId: req.user.departmentId }
      ];
    }

    const plans = await prisma.bSCPlan.findMany({
      where,
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, role: true } },
        department: true,
        _count: { select: { approvalHistory: true, attachments: true, comments: true, childPlans: true, contributors: true } },
        contributors: { include: { user: { select: { id: true, firstName: true, lastName: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(plans);
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const plan = await prisma.bSCPlan.findUnique({
      where: { id: req.params.id },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, role: true, email: true } },
        department: true,
        parentPlan: { select: { id: true, title: true } },
        childPlans: { select: { id: true, title: true, status: true, perspective: true } },
        approvalHistory: { include: { reviewer: { select: { firstName: true, lastName: true, role: true } } }, orderBy: { createdAt: 'desc' } },
        attachments: true,
        comments: { include: { user: { select: { firstName: true, lastName: true, role: true } } }, orderBy: { createdAt: 'desc' } },
        versions: { orderBy: { version: 'desc' } },
        contributors: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true, role: true, department: { select: { name: true } } } } } }
      }
    });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authenticate, [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
  body('perspective').isIn(['FINANCIAL', 'CUSTOMER', 'INTERNAL_BUSINESS_PROCESS', 'LEARNING_AND_GROWTH']).withMessage('Valid perspective is required'),
  body('strategicObjective').trim().notEmpty().withMessage('Strategic objective is required'),
  body('kpiName').trim().notEmpty().withMessage('KPI name is required'),
  body('target').isFloat({ min: 0 }).withMessage('Target must be a positive number'),
  body('weight').optional().isFloat({ min: 0, max: 100 }).withMessage('Weight must be between 0 and 100'),
  body('budget').optional().isFloat({ min: 0 }).withMessage('Budget must be a positive number'),
  body('startDate').optional().isISO8601().withMessage('Invalid start date'),
  body('endDate').optional().isISO8601().withMessage('Invalid end date'),
  validate
], async (req, res) => {
  try {
    const { title, description, perspective, strategicObjective, kpiName, kpiFormula, measurementUnit, baseline, target, actualResult, weight, objectiveNumber, strategicTheme, monthlyTargets, planYear, strategicInitiative, budget, startDate, endDate, parentPlanId, departmentId } = req.body;
    const plan = await prisma.bSCPlan.create({
      data: {
        title, description, perspective, strategicObjective, kpiName, kpiFormula, measurementUnit,
        baseline: parseFloat(baseline) || 0, target: parseFloat(target), actualResult: parseFloat(actualResult) || 0,
        weight: parseFloat(weight) || 0, objectiveNumber: objectiveNumber || null, strategicTheme: strategicTheme || null,
        monthlyTargets: normaliseMonthlyTargets(monthlyTargets), planYear: Number.isInteger(Number(planYear)) ? Number(planYear) : null,
        strategicInitiative, budget: parseFloat(budget) || 0,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        ownerId: req.user.id,
        departmentId: departmentId || req.user.departmentId,
        parentPlanId: parentPlanId || null,
        versions: {
          create: { version: 1, data: req.body }
        }
      },
      include: { owner: { select: { firstName: true, lastName: true } }, department: true }
    });
    await createAuditLog(req.user.id, `${req.user.firstName} ${req.user.lastName}`, 'CREATE_PLAN', 'BSCPlan', plan.id, { title, perspective });
    res.status(201).json(plan);
  } catch (error) {
    console.error('Create plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authenticate, [
  body('title').optional().trim().notEmpty().isLength({ max: 200 }),
  body('perspective').optional().isIn(['FINANCIAL', 'CUSTOMER', 'INTERNAL_BUSINESS_PROCESS', 'LEARNING_AND_GROWTH']),
  body('target').optional().isFloat({ min: 0 }),
  body('weight').optional().isFloat({ min: 0, max: 100 }),
  body('budget').optional().isFloat({ min: 0 }),
  validate
], async (req, res) => {
  try {
    const existingPlan = await prisma.bSCPlan.findUnique({ where: { id: req.params.id } });
    if (!existingPlan) return res.status(404).json({ error: 'Plan not found' });
    if (existingPlan.ownerId !== req.user.id && !['CEO', 'EXECUTIVE_MANAGER'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorized to edit this plan' });
    }
    const { title, description, perspective, strategicObjective, kpiName, kpiFormula, measurementUnit, baseline, target, actualResult, weight, objectiveNumber, strategicTheme, monthlyTargets, planYear, strategicInitiative, budget, startDate, endDate } = req.body;
    const newVersion = existingPlan.version + 1;
    const plan = await prisma.bSCPlan.update({
      where: { id: req.params.id },
      data: {
        title, description, perspective, strategicObjective, kpiName, kpiFormula, measurementUnit,
        baseline: parseFloat(baseline) || 0, target: parseFloat(target), actualResult: parseFloat(actualResult) || 0,
        weight: parseFloat(weight) || 0, objectiveNumber: objectiveNumber || null, strategicTheme: strategicTheme || null,
        monthlyTargets: normaliseMonthlyTargets(monthlyTargets), planYear: Number.isInteger(Number(planYear)) ? Number(planYear) : null,
        strategicInitiative, budget: parseFloat(budget) || 0,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        version: newVersion,
        status: existingPlan.status === 'RETURNED_FOR_REVISION' ? 'DRAFT' : existingPlan.status
      },
      include: { owner: { select: { firstName: true, lastName: true } }, department: true }
    });
    await prisma.planVersion.create({ data: { planId: plan.id, version: newVersion, data: req.body } });
    await createAuditLog(req.user.id, `${req.user.firstName} ${req.user.lastName}`, 'UPDATE_PLAN', 'BSCPlan', plan.id, { title, version: newVersion });
    res.json(plan);
  } catch (error) {
    console.error('Update plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const plan = await prisma.bSCPlan.findUnique({ where: { id: req.params.id } });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    if (plan.ownerId !== req.user.id || plan.status !== 'DRAFT') {
      return res.status(403).json({ error: 'Only the owner can delete draft plans' });
    }
    await prisma.bSCPlan.delete({ where: { id: req.params.id } });
    res.json({ message: 'Plan deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const attachment = await prisma.attachment.create({
      data: {
        planId: req.params.id,
        fileName: req.file.originalname,
        filePath: req.file.path,
        fileSize: req.file.size,
        mimeType: req.file.mimetype
      }
    });
    res.status(201).json(attachment);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/comments', authenticate, [
  body('content').trim().notEmpty().withMessage('Comment content is required').isLength({ max: 2000 }),
  validate
], async (req, res) => {
  try {
    const { content } = req.body;
    const comment = await prisma.planComment.create({
      data: { planId: req.params.id, userId: req.user.id, content },
      include: { user: { select: { firstName: true, lastName: true, role: true } } }
    });
    const plan = await prisma.bSCPlan.findUnique({ where: { id: req.params.id } });
    if (plan.ownerId !== req.user.id) {
      await createNotification(plan.ownerId, 'New Comment', `${req.user.firstName} ${req.user.lastName} commented on your plan "${plan.title}"`, 'COMMENT', `/plans/${plan.id}`);
    }
    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/pending-reviews/all', authenticate, authorize('DEPARTMENT_MANAGER', 'EXECUTIVE_MANAGER', 'CEO'), async (req, res) => {
  try {
    let where = { status: 'SUBMITTED' };
    if (req.user.role === 'DEPARTMENT_MANAGER') {
      where.OR = [
        { departmentId: req.user.departmentId, status: 'SUBMITTED' },
        { departmentId: req.user.departmentId, status: 'UNDER_REVIEW' }
      ];
    }
    const plans = await prisma.bSCPlan.findMany({
      where,
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, role: true } },
        department: true,
        _count: { select: { approvalHistory: true } }
      },
      orderBy: { createdAt: 'asc' }
    });
    res.json(plans);
  } catch (error) {
    console.error('Pending reviews error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
