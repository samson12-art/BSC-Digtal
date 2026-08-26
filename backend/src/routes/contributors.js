const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const prisma = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');
const { createAuditLog, createNotification } = require('../utils/helpers');
const { validate } = require('../middleware/validate');

const scoreOrZero = value => Math.max(0, Math.min(150, Number(value) || 0));
const contributionScore = (contributor, plan) => {
  const result = contributor.individualTarget > 0
    ? scoreOrZero((contributor.individualActual / contributor.individualTarget) * 100)
    : scoreOrZero((plan.actualResult / plan.target) * 100);
  const quality = scoreOrZero(contributor.qualityScore);
  const timeliness = scoreOrZero(contributor.timelinessScore);
  const collaboration = scoreOrZero(contributor.collaborationScore);
  const shared = scoreOrZero((plan.actualResult / plan.target) * 100) * (contributor.contributionPct / 100);
  const baseScore = (result * .40) + (quality * .20) + (timeliness * .15) + (shared * .15) + (collaboration * .10);
  return { result, quality, timeliness, collaboration, shared: Math.round(shared * 10) / 10, baseScore: Math.round(baseScore * 10) / 10, finalScore: Math.round(baseScore * (contributor.adjustmentFactor || 1) * 10) / 10 };
};

router.get('/my-contributions', authenticate, async (req, res) => {
  try {
    const contributions = await prisma.planContributor.findMany({
      where: { userId: req.user.id },
      include: {
        plan: {
          select: {
            id: true, title: true, perspective: true, status: true,
            target: true, actualResult: true, weight: true,
            owner: { select: { firstName: true, lastName: true } },
            department: { select: { name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const enriched = contributions.map(c => ({
      ...c,
      plan: {
        ...c.plan,
        achievementPercentage: c.plan.target > 0 ? Math.min(Math.round((c.plan.actualResult / c.plan.target) * 100), 150) : 0,
        weightedAchievement: c.plan.target > 0 ? Math.min(Math.round((c.plan.actualResult / c.plan.target) * 100), 150) * (c.contributionPct / 100) : 0
      },
      score: contributionScore(c, c.plan)
    }));

    const totalWeightedAchievement = enriched.reduce((sum, c) => sum + c.plan.weightedAchievement, 0);
    const totalContributionPct = contributions.reduce((sum, c) => sum + c.contributionPct, 0);

    res.json({
      contributions: enriched,
      summary: {
        totalPlansContributed: contributions.length,
        totalContributionPct,
        weightedAchievement: Math.round(totalWeightedAchievement),
        avgContributionPct: contributions.length > 0 ? Math.round(totalContributionPct / contributions.length) : 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Contributors submit verified, individual results. Evidence is stored as a
// small structured list (for example CRM report number, document URL, note).
router.post('/:id/performance', authenticate, [
  body('individualTarget').optional({ nullable: true }).isFloat({ min: 0 }),
  body('individualActual').optional({ nullable: true }).isFloat({ min: 0 }),
  body('qualityScore').isFloat({ min: 0, max: 150 }),
  body('timelinessScore').isFloat({ min: 0, max: 150 }),
  body('collaborationScore').isFloat({ min: 0, max: 150 }),
  body('dependencyDelayPct').optional().isFloat({ min: 0, max: 100 }),
  body('dependencyReason').optional().trim().isLength({ max: 1000 }),
  body('evidence').isArray({ min: 1, max: 20 }).withMessage('At least one evidence item is required'),
  body('evidence.*.type').optional().trim().isLength({ max: 100 }),
  body('evidence.*.reference').optional().trim().isLength({ max: 1000 }),
  validate
], async (req, res) => {
  try {
    const contributor = await prisma.planContributor.findUnique({ where: { id: req.params.id }, include: { plan: true } });
    if (!contributor) return res.status(404).json({ error: 'Contributor not found' });
    if (contributor.userId !== req.user.id) return res.status(403).json({ error: 'Only the assigned contributor can submit this result' });
    const data = {
      individualTarget: req.body.individualTarget === null || req.body.individualTarget === undefined ? null : Number(req.body.individualTarget),
      individualActual: req.body.individualActual === null || req.body.individualActual === undefined ? null : Number(req.body.individualActual),
      qualityScore: Number(req.body.qualityScore), timelinessScore: Number(req.body.timelinessScore), collaborationScore: Number(req.body.collaborationScore),
      dependencyDelayPct: Number(req.body.dependencyDelayPct || 0), dependencyReason: req.body.dependencyReason || null,
      evidence: req.body.evidence, reviewStatus: 'SUBMITTED', submittedAt: new Date(), reviewerId: null, reviewerComments: null, reviewedAt: null,
      adjustmentFactor: 1, adjustmentReason: null
    };
    const updated = await prisma.planContributor.update({ where: { id: contributor.id }, data, include: { plan: true, user: { select: { firstName: true, lastName: true } } } });
    await createNotification(contributor.plan.ownerId, 'Contribution awaiting review', `${req.user.firstName} ${req.user.lastName} submitted a contribution result for "${contributor.plan.title}".`, 'COMMENT', `/plans/${contributor.planId}`);
    await createAuditLog(req.user.id, `${req.user.firstName} ${req.user.lastName}`, 'SUBMIT_CONTRIBUTION_RESULT', 'PlanContributor', contributor.id, { planId: contributor.planId });
    res.json({ ...updated, score: contributionScore(updated, updated.plan) });
  } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/:id/review', authenticate, [
  body('action').isIn(['APPROVE', 'RETURN']).withMessage('Action must be APPROVE or RETURN'),
  body('comments').optional().trim().isLength({ max: 2000 }),
  body('adjustmentFactor').optional().isFloat({ min: 0.5, max: 1.5 }),
  body('adjustmentReason').optional().trim().isLength({ max: 1000 }),
  validate
], async (req, res) => {
  try {
    const contributor = await prisma.planContributor.findUnique({ where: { id: req.params.id }, include: { plan: true, user: true } });
    if (!contributor) return res.status(404).json({ error: 'Contributor not found' });
    const isReviewer = contributor.plan.ownerId === req.user.id || contributor.user.managerId === req.user.id || ['CEO', 'EXECUTIVE_MANAGER', 'DEPARTMENT_MANAGER', 'DIVISION_MANAGER'].includes(req.user.role);
    if (!isReviewer) return res.status(403).json({ error: 'Only the objective owner or supervisor can review this contribution' });
    if (contributor.reviewStatus !== 'SUBMITTED') return res.status(400).json({ error: 'Only submitted contributions can be reviewed' });
    const factor = req.body.adjustmentFactor === undefined ? 1 : Number(req.body.adjustmentFactor);
    if (factor !== 1 && !req.body.adjustmentReason) return res.status(400).json({ error: 'An adjustment reason is required when changing the score' });
    const updated = await prisma.planContributor.update({ where: { id: contributor.id }, data: { reviewStatus: req.body.action === 'APPROVE' ? 'APPROVED' : 'RETURNED', reviewerId: req.user.id, reviewerComments: req.body.comments || null, reviewedAt: new Date(), adjustmentFactor: factor, adjustmentReason: req.body.adjustmentReason || null }, include: { plan: true, user: { select: { firstName: true, lastName: true } } } });
    await createNotification(contributor.userId, `Contribution ${req.body.action === 'APPROVE' ? 'approved' : 'returned'}`, `Your result for "${contributor.plan.title}" was ${req.body.action === 'APPROVE' ? 'approved' : 'returned for correction'}.`, 'COMMENT', `/plans/${contributor.planId}`);
    await createAuditLog(req.user.id, `${req.user.firstName} ${req.user.lastName}`, 'REVIEW_CONTRIBUTION_RESULT', 'PlanContributor', contributor.id, { action: req.body.action, adjustmentFactor: factor });
    res.json({ ...updated, score: contributionScore(updated, updated.plan) });
  } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/plan/:planId', authenticate, async (req, res) => {
  try {
    const contributors = await prisma.planContributor.findMany({
      where: { planId: req.params.planId },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, role: true, department: { select: { name: true } } } } },
      orderBy: { contributionPct: 'desc' }
    });
    res.json(contributors);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/plan/:planId', authenticate, [
  body('userId').notEmpty().withMessage('User ID is required'),
  body('contributionPct').isFloat({ min: 1, max: 100 }).withMessage('Contribution must be between 1 and 100'),
  body('role').optional().trim().isLength({ max: 100 }),
  validate
], async (req, res) => {
  try {
    const plan = await prisma.bSCPlan.findUnique({ where: { id: req.params.planId } });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    if (plan.ownerId !== req.user.id && !['CEO', 'EXECUTIVE_MANAGER'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only the plan owner or executives can add contributors' });
    }

    const existing = await prisma.planContributor.findUnique({
      where: { planId_userId: { planId: req.params.planId, userId: req.body.userId } }
    });
    if (existing) {
      return res.status(400).json({ error: 'User is already a contributor on this plan' });
    }

    const existingContributors = await prisma.planContributor.findMany({
      where: { planId: req.params.planId }
    });
    const totalExisting = existingContributors.reduce((sum, c) => sum + c.contributionPct, 0);
    if (totalExisting + req.body.contributionPct > 100) {
      return res.status(400).json({
        error: `Total contributions would exceed 100%. Currently: ${totalExisting}%. Remaining: ${100 - totalExisting}%`
      });
    }

    const contributor = await prisma.planContributor.create({
      data: {
        planId: req.params.planId,
        userId: req.body.userId,
        contributionPct: parseFloat(req.body.contributionPct),
        role: req.body.role || null
      },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } } }
    });

    const user = await prisma.user.findUnique({ where: { id: req.body.userId } });
    if (user) {
      await createNotification(req.body.userId, 'Added as Contributor', `You have been added as a ${req.body.contributionPct}% contributor to plan "${plan.title}"`, 'COMMENT', `/plans/${plan.id}`);
    }
    await createAuditLog(req.user.id, `${req.user.firstName} ${req.user.lastName}`, 'ADD_CONTRIBUTOR', 'PlanContributor', contributor.id, { planId: plan.id, userId: req.body.userId, contributionPct: req.body.contributionPct });

    res.status(201).json(contributor);
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ error: 'User is already a contributor' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authenticate, [
  body('contributionPct').isFloat({ min: 1, max: 100 }).withMessage('Contribution must be between 1 and 100'),
  validate
], async (req, res) => {
  try {
    const existing = await prisma.planContributor.findUnique({ where: { id: req.params.id }, include: { plan: true } });
    if (!existing) return res.status(404).json({ error: 'Contributor not found' });
    if (existing.plan.ownerId !== req.user.id && !['CEO', 'EXECUTIVE_MANAGER'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const otherContributors = await prisma.planContributor.findMany({
      where: { planId: existing.planId, id: { not: req.params.id } }
    });
    const totalOthers = otherContributors.reduce((sum, c) => sum + c.contributionPct, 0);
    if (totalOthers + req.body.contributionPct > 100) {
      return res.status(400).json({
        error: `Total contributions would exceed 100%. Others: ${totalOthers}%. Remaining: ${100 - totalOthers}`
      });
    }

    const contributor = await prisma.planContributor.update({
      where: { id: req.params.id },
      data: { contributionPct: parseFloat(req.body.contributionPct), role: req.body.role },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } } }
    });
    res.json(contributor);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const existing = await prisma.planContributor.findUnique({ where: { id: req.params.id }, include: { plan: true } });
    if (!existing) return res.status(404).json({ error: 'Contributor not found' });
    if (existing.plan.ownerId !== req.user.id && !['CEO', 'EXECUTIVE_MANAGER'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.planContributor.delete({ where: { id: req.params.id } });
    await createAuditLog(req.user.id, `${req.user.firstName} ${req.user.lastName}`, 'REMOVE_CONTRIBUTOR', 'PlanContributor', req.params.id, { planId: existing.planId, userId: existing.userId });
    res.json({ message: 'Contributor removed' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
