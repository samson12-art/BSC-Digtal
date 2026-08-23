const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { calculateAchievementPercentage } = require('../utils/helpers');

router.get('/employee', authenticate, async (req, res) => {
  try {
    const plans = await prisma.bSCPlan.findMany({
      where: { ownerId: req.user.id },
      include: { department: true, contributors: { include: { user: { select: { firstName: true, lastName: true } } } } }
    });

    const contributions = await prisma.planContributor.findMany({
      where: { userId: req.user.id },
      include: { plan: { include: { owner: { select: { firstName: true, lastName: true } }, department: true } } }
    });

    const totalPlans = plans.length;
    const approvedPlans = plans.filter(p => p.status === 'APPROVED' || p.status === 'FINAL_APPROVED').length;
    const pendingPlans = plans.filter(p => p.status === 'SUBMITTED' || p.status === 'UNDER_REVIEW').length;
    const draftPlans = plans.filter(p => p.status === 'DRAFT').length;
    const avgAchievement = plans.length > 0
      ? plans.reduce((sum, p) => sum + calculateAchievementPercentage(p.actualResult, p.target), 0) / plans.length
      : 0;

    const byPerspective = {};
    ['FINANCIAL', 'CUSTOMER', 'INTERNAL_BUSINESS_PROCESS', 'LEARNING_AND_GROWTH'].forEach(perp => {
      const pp = plans.filter(p => p.perspective === perp);
      byPerspective[perp] = {
        count: pp.length,
        avgAchievement: pp.length > 0
          ? pp.reduce((sum, p) => sum + calculateAchievementPercentage(p.actualResult, p.target), 0) / pp.length
          : 0,
        plans: pp.map(p => ({ ...p, achievementPercentage: calculateAchievementPercentage(p.actualResult, p.target) }))
      };
    });

    const contributedPlans = contributions.map(c => ({
      id: c.plan.id,
      title: c.plan.title,
      perspective: c.plan.perspective,
      status: c.plan.status,
      target: c.plan.target,
      actualResult: c.plan.actualResult,
      achievementPercentage: calculateAchievementPercentage(c.plan.actualResult, c.plan.target),
      myContributionPct: c.contributionPct,
      myWeightedScore: Math.round(calculateAchievementPercentage(c.plan.actualResult, c.plan.target) * (c.contributionPct / 100)),
      ownerName: `${c.plan.owner.firstName} ${c.plan.owner.lastName}`,
      department: c.plan.department
    }));

    const totalContributionScore = contributions.length > 0
      ? Math.round(contributions.reduce((sum, c) => sum + calculateAchievementPercentage(c.plan.actualResult, c.plan.target) * (c.contributionPct / 100), 0) / contributions.length)
      : 0;

    res.json({
      totalPlans, approvedPlans, pendingPlans, draftPlans,
      avgAchievement: Math.round(avgAchievement),
      totalContributedPlans: contributions.length,
      totalContributionScore,
      byPerspective,
      contributedPlans,
      recentPlans: plans.slice(0, 5)
    });
  } catch (error) {
    console.error('Employee dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/manager', authenticate, authorize('DEPARTMENT_MANAGER'), async (req, res) => {
  try {
    const teamPlans = await prisma.bSCPlan.findMany({
      where: {
        OR: [
          { ownerId: req.user.id },
          { owner: { managerId: req.user.id } },
          { departmentId: req.user.departmentId }
        ]
      },
      include: { owner: { select: { id: true, firstName: true, lastName: true } }, department: true }
    });

    const pendingReviews = teamPlans.filter(p => p.status === 'SUBMITTED');
    const teamMembers = await prisma.user.findMany({ where: { managerId: req.user.id, isActive: true } });

    const performanceByMember = teamMembers.map(member => {
      const memberPlans = teamPlans.filter(p => p.ownerId === member.id);
      return {
        ...({ firstName: member.firstName, lastName: member.lastName, id: member.id }),
        totalPlans: memberPlans.length,
        avgAchievement: memberPlans.length > 0
          ? Math.round(memberPlans.reduce((sum, p) => sum + calculateAchievementPercentage(p.actualResult, p.target), 0) / memberPlans.length)
          : 0
      };
    });

    const overallAchievement = teamPlans.length > 0
      ? Math.round(teamPlans.reduce((sum, p) => sum + calculateAchievementPercentage(p.actualResult, p.target), 0) / teamPlans.length)
      : 0;

    res.json({ totalPlans: teamPlans.length, pendingReviews: pendingReviews.length, teamSize: teamMembers.length, overallAchievement, performanceByMember, pendingReviewPlans: pendingReviews, recentPlans: teamPlans.slice(0, 10) });
  } catch (error) {
    console.error('Manager dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/executive', authenticate, authorize('EXECUTIVE_MANAGER', 'CEO', 'BOARD_MEMBER'), async (req, res) => {
  try {
    const allPlans = await prisma.bSCPlan.findMany({
      include: { owner: { select: { id: true, firstName: true, lastName: true, role: true } }, department: true }
    });
    const departments = await prisma.department.findMany({ include: { _count: { select: { employees: true } } } });
    const users = await prisma.user.findMany({ where: { isActive: true } });

    const totalPlans = allPlans.length;
    const finalApproved = allPlans.filter(p => p.status === 'FINAL_APPROVED').length;
    const approved = allPlans.filter(p => p.status === 'APPROVED').length;
    const pending = allPlans.filter(p => ['SUBMITTED', 'UNDER_REVIEW'].includes(p.status)).length;
    const rejected = allPlans.filter(p => p.status === 'REJECTED').length;
    const draft = allPlans.filter(p => p.status === 'DRAFT').length;

    const overallAchievement = allPlans.length > 0
      ? Math.round(allPlans.reduce((sum, p) => sum + calculateAchievementPercentage(p.actualResult, p.target), 0) / allPlans.length)
      : 0;

    const byPerspective = {};
    ['FINANCIAL', 'CUSTOMER', 'INTERNAL_BUSINESS_PROCESS', 'LEARNING_AND_GROWTH'].forEach(perp => {
      const pp = allPlans.filter(p => p.perspective === perp);
      byPerspective[perp] = {
        count: pp.length,
        avgAchievement: pp.length > 0 ? Math.round(pp.reduce((sum, p) => sum + calculateAchievementPercentage(p.actualResult, p.target), 0) / pp.length) : 0,
        totalBudget: pp.reduce((sum, p) => sum + (p.budget || 0), 0)
      };
    });

    const byDepartment = departments.map(dept => {
      const deptPlans = allPlans.filter(p => p.departmentId === dept.id);
      return {
        id: dept.id, name: dept.name, totalPlans: deptPlans.length,
        avgAchievement: deptPlans.length > 0 ? Math.round(deptPlans.reduce((sum, p) => sum + calculateAchievementPercentage(p.actualResult, p.target), 0) / deptPlans.length) : 0,
        employeeCount: dept._count.employees,
        statusBreakdown: {
          draft: deptPlans.filter(p => p.status === 'DRAFT').length,
          submitted: deptPlans.filter(p => p.status === 'SUBMITTED').length,
          approved: deptPlans.filter(p => ['APPROVED', 'FINAL_APPROVED'].includes(p.status)).length,
          rejected: deptPlans.filter(p => p.status === 'REJECTED').length
        }
      };
    });

    const statusBreakdown = { DRAFT: draft, SUBMITTED: pending, APPROVED: approved, FINAL_APPROVED: finalApproved, REJECTED: rejected };

    res.json({
      totalPlans, overallAchievement, totalEmployees: users.length, totalDepartments: departments.length,
      statusBreakdown, byPerspective, byDepartment,
      recentActivity: allPlans.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 15),
      topPerformers: allPlans.filter(p => p.status === 'FINAL_APPROVED').sort((a, b) => calculateAchievementPercentage(b.actualResult, b.target) - calculateAchievementPercentage(a.actualResult, a.target)).slice(0, 10)
    });
  } catch (error) {
    console.error('Executive dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
