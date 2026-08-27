const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { createAuditLog, createNotification } = require('../utils/helpers');
const { validate } = require('../middleware/validate');

router.post('/:planId/approve', authenticate, authorize('DIVISION_MANAGER', 'DEPARTMENT_MANAGER', 'EXECUTIVE_MANAGER', 'CEO', 'BOARD_MEMBER'), async (req, res) => {
  try {
    const { comments } = req.body;
    const plan = await prisma.bSCPlan.findUnique({ where: { id: req.params.planId }, include: { owner: true, department: true } });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    if (plan.status !== 'SUBMITTED' && plan.status !== 'UNDER_REVIEW') {
      return res.status(400).json({ error: 'Plan is not in a reviewable state' });
    }

    const approval = await prisma.approvalHistory.create({
      data: { planId: plan.id, reviewerId: req.user.id, action: 'APPROVE', comments: comments || 'Approved' }
    });

    let updatedPlan;
    if (req.user.role === 'CEO') {
      updatedPlan = await prisma.bSCPlan.update({ where: { id: plan.id }, data: { status: 'FINAL_APPROVED' } });
    } else {
      updatedPlan = await prisma.bSCPlan.update({ where: { id: plan.id }, data: { status: 'UNDER_REVIEW' } });
    }

    await createNotification(plan.ownerId, 'Plan Approved', `Your plan "${plan.title}" has been approved by ${req.user.firstName} ${req.user.lastName}`, 'APPROVAL', `/plans/${plan.id}`);
    await createAuditLog(req.user.id, `${req.user.firstName} ${req.user.lastName}`, 'APPROVE_PLAN', 'BSCPlan', plan.id, { status: updatedPlan.status, comments });

    res.json({ plan: updatedPlan, approval });
  } catch (error) {
    console.error('Approve error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:planId/reject', authenticate, authorize('DIVISION_MANAGER', 'DEPARTMENT_MANAGER', 'EXECUTIVE_MANAGER', 'CEO', 'BOARD_MEMBER'), [
  body('comments').trim().notEmpty().withMessage('Rejection reason is required').isLength({ min: 10, max: 2000 }),
  validate
], async (req, res) => {
  try {
    const { comments } = req.body;
    const plan = await prisma.bSCPlan.findUnique({ where: { id: req.params.planId }, include: { owner: true } });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    if (plan.status !== 'SUBMITTED' && plan.status !== 'UNDER_REVIEW') {
      return res.status(400).json({ error: 'Plan is not in a reviewable state' });
    }

    const approval = await prisma.approvalHistory.create({
      data: { planId: plan.id, reviewerId: req.user.id, action: 'REJECT', comments }
    });
    const updatedPlan = await prisma.bSCPlan.update({ where: { id: plan.id }, data: { status: 'REJECTED' } });

    await createNotification(plan.ownerId, 'Plan Rejected', `Your plan "${plan.title}" has been rejected. Reason: ${comments}`, 'REJECTION', `/plans/${plan.id}`);
    await createAuditLog(req.user.id, `${req.user.firstName} ${req.user.lastName}`, 'REJECT_PLAN', 'BSCPlan', plan.id, { comments });

    res.json({ plan: updatedPlan, approval });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:planId/return', authenticate, authorize('DIVISION_MANAGER', 'DEPARTMENT_MANAGER', 'EXECUTIVE_MANAGER', 'CEO'), [
  body('comments').trim().notEmpty().withMessage('Revision comments are required').isLength({ min: 10, max: 2000 }),
  validate
], async (req, res) => {
  try {
    const { comments } = req.body;
    const plan = await prisma.bSCPlan.findUnique({ where: { id: req.params.planId }, include: { owner: true } });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    const approval = await prisma.approvalHistory.create({
      data: { planId: plan.id, reviewerId: req.user.id, action: 'RETURN_FOR_REVISION', comments }
    });
    const updatedPlan = await prisma.bSCPlan.update({ where: { id: plan.id }, data: { status: 'RETURNED_FOR_REVISION' } });

    await createNotification(plan.ownerId, 'Revision Requested', `Your plan "${plan.title}" has been returned for revision. Comments: ${comments}`, 'REVISION', `/plans/${plan.id}`);
    await createAuditLog(req.user.id, `${req.user.firstName} ${req.user.lastName}`, 'RETURN_PLAN', 'BSCPlan', plan.id, { comments });

    res.json({ plan: updatedPlan, approval });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:planId/submit', authenticate, async (req, res) => {
  try {
    const plan = await prisma.bSCPlan.findUnique({ where: { id: req.params.planId }, include: { owner: true } });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    if (plan.ownerId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    if (!['DRAFT', 'RETURNED_FOR_REVISION'].includes(plan.status)) {
      return res.status(400).json({ error: 'Plan cannot be submitted in its current state' });
    }

    const approval = await prisma.approvalHistory.create({
      data: { planId: plan.id, reviewerId: req.user.id, action: 'SUBMIT', comments: 'Submitted for review' }
    });
    const updatedPlan = await prisma.bSCPlan.update({ where: { id: plan.id }, data: { status: 'SUBMITTED' } });

    const reviewerRoleMap = {
      'EMPLOYEE': 'DIVISION_MANAGER',
      'DIVISION_MANAGER': 'DEPARTMENT_MANAGER',
      'DEPARTMENT_MANAGER': 'EXECUTIVE_MANAGER', 'EXECUTIVE_MANAGER': 'CEO'
    };
    const reviewerRole = reviewerRoleMap[req.user.role];
    if (reviewerRole) {
      const reviewerWhere = { role: reviewerRole, isActive: true };
      if (reviewerRole === 'DIVISION_MANAGER' && req.user.divisionId) reviewerWhere.divisionId = req.user.divisionId;
      if (reviewerRole === 'DEPARTMENT_MANAGER') reviewerWhere.departmentId = req.user.departmentId;
      const reviewers = await prisma.user.findMany({ where: reviewerWhere });
      for (const reviewer of reviewers) {
        const shouldNotify = reviewerRole === 'DIVISION_MANAGER'
          ? reviewer.divisionId === req.user.divisionId
          : reviewerRole === 'DEPARTMENT_MANAGER'
            ? reviewer.departmentId === req.user.departmentId
            : true;
        if (shouldNotify || reviewers.length <= 3) {
          await createNotification(reviewer.id, 'Plan Pending Review', `${req.user.firstName} ${req.user.lastName} submitted "${plan.title}" for your review`, 'REVIEW_REQUIRED', `/reviews`);
        }
      }
    }

    await createAuditLog(req.user.id, `${req.user.firstName} ${req.user.lastName}`, 'SUBMIT_PLAN', 'BSCPlan', plan.id, { status: 'SUBMITTED' });
    res.json({ plan: updatedPlan, approval });
  } catch (error) {
    console.error('Submit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
