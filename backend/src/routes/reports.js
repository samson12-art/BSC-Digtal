const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const prisma = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');
const { calculateAchievementPercentage } = require('../utils/helpers');

router.get('/individual/:userId', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      include: { department: true }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const ownedPlans = await prisma.bSCPlan.findMany({
      where: { ownerId: req.params.userId },
      include: { approvalHistory: { include: { reviewer: { select: { firstName: true, lastName: true, role: true } } } }, department: true, contributors: { include: { user: { select: { firstName: true, lastName: true, role: true } } } } },
      orderBy: { createdAt: 'desc' }
    });

    const contributions = await prisma.planContributor.findMany({
      where: { userId: req.params.userId },
      include: { plan: { include: { owner: { select: { firstName: true, lastName: true } }, department: true, contributors: true } } }
    });

    const enrichedOwnedPlans = ownedPlans.map(p => ({
      ...p,
      achievementPercentage: calculateAchievementPercentage(p.actualResult, p.target),
      totalContributorWeight: p.contributors.reduce((sum, c) => sum + c.contributionPct, 0),
      ownerWeight: Math.max(0, 100 - p.contributors.reduce((sum, c) => sum + c.contributionPct, 0))
    }));

    const contributedPlans = contributions.map(c => ({
      ...c.plan,
      achievementPercentage: calculateAchievementPercentage(c.plan.actualResult, c.plan.target),
      myContributionPct: c.contributionPct,
      myWeightedScore: Math.round(calculateAchievementPercentage(c.plan.actualResult, c.plan.target) * (c.contributionPct / 100)),
      ownerName: `${c.plan.owner.firstName} ${c.plan.owner.lastName}`
    }));

    const ownedAvgAchievement = ownedPlans.length > 0 ? Math.round(ownedPlans.reduce((sum, p) => sum + calculateAchievementPercentage(p.actualResult, p.target), 0) / ownedPlans.length) : 0;

    const weightedOwnedScore = ownedPlans.length > 0
      ? Math.round(ownedPlans.reduce((sum, p) => {
          const achievement = calculateAchievementPercentage(p.actualResult, p.target);
          const ownerPct = Math.max(0, 100 - (p.contributors?.reduce((s, c) => s + c.contributionPct, 0) || 0));
          return sum + achievement * (ownerPct / 100);
        }, 0) / ownedPlans.length)
      : 0;

    const contributedScore = contributions.length > 0
      ? Math.round(contributions.reduce((sum, c) => sum + calculateAchievementPercentage(c.plan.actualResult, c.plan.target) * (c.contributionPct / 100), 0))
      : 0;

    const totalBudget = ownedPlans.reduce((sum, p) => sum + (p.budget || 0), 0);

    res.json({
      user: { id: user.id, firstName: user.firstName, lastName: user.lastName, role: user.role, department: user.department?.name },
      plans: enrichedOwnedPlans,
      contributedPlans,
      summary: {
        totalOwnedPlans: ownedPlans.length,
        totalContributedPlans: contributions.length,
        totalPlansInvolved: ownedPlans.length + contributions.length,
        ownedAvgAchievement: ownedAvgAchievement,
        weightedOwnedScore,
        contributedScore,
        combinedScore: Math.round((weightedOwnedScore + contributedScore) / Math.max(1, (ownedPlans.length > 0 ? 1 : 0) + (contributions.length > 0 ? 1 : 0))),
        totalBudget
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/department/:departmentId', authenticate, async (req, res) => {
  try {
    const department = await prisma.department.findUnique({
      where: { id: req.params.departmentId },
      include: { employees: true }
    });
    if (!department) return res.status(404).json({ error: 'Department not found' });
    const plans = await prisma.bSCPlan.findMany({
      where: { departmentId: req.params.departmentId },
      include: { owner: { select: { firstName: true, lastName: true, role: true } } },
      orderBy: { createdAt: 'desc' }
    });
    const enrichedPlans = plans.map(p => ({ ...p, achievementPercentage: calculateAchievementPercentage(p.actualResult, p.target) }));
    const avgAchievement = plans.length > 0 ? Math.round(plans.reduce((sum, p) => sum + calculateAchievementPercentage(p.actualResult, p.target), 0) / plans.length) : 0;
    const byPerspective = {};
    ['FINANCIAL', 'CUSTOMER', 'INTERNAL_BUSINESS_PROCESS', 'LEARNING_AND_GROWTH'].forEach(perp => {
      const pp = plans.filter(p => p.perspective === perp);
      byPerspective[perp] = { count: pp.length, avgAchievement: pp.length > 0 ? Math.round(pp.reduce((sum, p) => sum + calculateAchievementPercentage(p.actualResult, p.target), 0) / pp.length) : 0 };
    });
    res.json({ department: { id: department.id, name: department.name, employeeCount: department.employees.length }, plans: enrichedPlans, summary: { totalPlans: plans.length, avgAchievement, totalBudget: plans.reduce((s, p) => s + (p.budget || 0), 0) }, byPerspective });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/corporate', authenticate, async (req, res) => {
  try {
    const plans = await prisma.bSCPlan.findMany({ include: { owner: { select: { firstName: true, lastName: true, role: true } }, department: true } });
    const departments = await prisma.department.findMany();
    const enrichedPlans = plans.map(p => ({ ...p, achievementPercentage: calculateAchievementPercentage(p.actualResult, p.target) }));
    const avgAchievement = plans.length > 0 ? Math.round(plans.reduce((sum, p) => sum + calculateAchievementPercentage(p.actualResult, p.target), 0) / plans.length) : 0;
    const byPerspective = {};
    ['FINANCIAL', 'CUSTOMER', 'INTERNAL_BUSINESS_PROCESS', 'LEARNING_AND_GROWTH'].forEach(perp => {
      const pp = plans.filter(p => p.perspective === perp);
      byPerspective[perp] = { count: pp.length, avgAchievement: pp.length > 0 ? Math.round(pp.reduce((sum, p) => sum + calculateAchievementPercentage(p.actualResult, p.target), 0) / pp.length) : 0, totalBudget: pp.reduce((s, p) => s + (p.budget || 0), 0) };
    });
    const byDepartment = departments.map(dept => {
      const dp = plans.filter(p => p.departmentId === dept.id);
      return { name: dept.name, totalPlans: dp.length, avgAchievement: dp.length > 0 ? Math.round(dp.reduce((sum, p) => sum + calculateAchievementPercentage(p.actualResult, p.target), 0) / dp.length) : 0 };
    });
    res.json({ summary: { totalPlans: plans.length, avgAchievement, totalBudget: plans.reduce((s, p) => s + (p.budget || 0), 0), approved: plans.filter(p => p.status === 'FINAL_APPROVED').length }, byPerspective, byDepartment, plans: enrichedPlans });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/excel/:type/:id?', authenticate, async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();

    // ── Summary Sheet ──
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.mergeCells('A1:H1');
    const titleCell = summarySheet.getCell('A1');
    titleCell.value = 'Balanced Scorecard — Performance Report';
    titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF136F63' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    summarySheet.getRow(1).height = 40;

    let plans, info, contributions;
    if (req.params.type === 'individual') {
      info = await prisma.user.findUnique({ where: { id: req.params.id || req.user.id }, include: { department: true } });
      plans = await prisma.bSCPlan.findMany({ where: { ownerId: info.id }, include: { contributors: { include: { user: { select: { firstName: true, lastName: true } } } } } });
      const contribs = await prisma.planContributor.findMany({ where: { userId: info.id }, include: { plan: { select: { id: true, title: true }, include: { owner: { select: { firstName: true, lastName: true } } } } } });
      contributions = contribs;
    } else if (req.params.type === 'department') {
      info = await prisma.department.findUnique({ where: { id: req.params.id } });
      plans = await prisma.bSCPlan.findMany({ where: { departmentId: req.params.id }, include: { owner: { select: { firstName: true, lastName: true } }, department: true, contributors: { include: { user: { select: { firstName: true, lastName: true } } } } } });
      contributions = null;
    } else {
      info = null;
      plans = await prisma.bSCPlan.findMany({ include: { owner: { select: { firstName: true, lastName: true } }, department: true, contributors: { include: { user: { select: { firstName: true, lastName: true } } } } } });
      contributions = null;
    }

    const avgAchievement = plans.length > 0 ? Math.round(plans.reduce((s, p) => s + calculateAchievementPercentage(p.actualResult, p.target), 0) / plans.length) : 0;
    const totalBudget = plans.reduce((s, p) => s + (p.budget || 0), 0);
    const statusCounts = { DRAFT: 0, SUBMITTED: 0, UNDER_REVIEW: 0, APPROVED: 0, FINAL_APPROVED: 0, REJECTED: 0, RETURNED_FOR_REVISION: 0 };
    plans.forEach(p => { if (statusCounts[p.status] !== undefined) statusCounts[p.status]++; });

    summarySheet.getCell('A3').value = 'Report Type:';
    summarySheet.getCell('B3').value = req.params.type === 'individual' ? 'Individual Performance' : req.params.type === 'department' ? 'Department Scorecard' : 'Corporate Scorecard';
    summarySheet.getCell('A3').font = { bold: true };
    if (info) {
      summarySheet.getCell('A4').value = req.params.type === 'individual' ? 'Employee:' : 'Department:';
      summarySheet.getCell('B4').value = req.params.type === 'individual' ? `${info.firstName} ${info.lastName}${info.department ? ' (' + info.department.name + ')' : ''}` : info.name;
      summarySheet.getCell('A4').font = { bold: true };
    }

    if (req.params.type === 'individual' && contributions && contributions.length > 0) {
      const contribScore = Math.round(contributions.reduce((s, c) => s + calculateAchievementPercentage(c.plan.actualResult, c.plan.target) * (c.contributionPct / 100), 0));
      summarySheet.getCell('A5').value = 'Team Contribution Score:';
      summarySheet.getCell('B5').value = `${contribScore}% (${contributions.length} plans)`;
      summarySheet.getCell('A5').font = { bold: true };
    }

    summarySheet.getCell('A6').value = 'Metric';
    summarySheet.getCell('B6').value = 'Value';
    summarySheet.getCell('A6').font = { bold: true, color: { argb: 'FFFFFFFF' } };
    summarySheet.getCell('B6').font = { bold: true, color: { argb: 'FFFFFFFF' } };
    summarySheet.getCell('A6').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF136F63' } };
    summarySheet.getCell('B6').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF136F63' } };

    const summaryRows = [
      ['Total Plans', plans.length],
      ['Average Achievement', `${avgAchievement}%`],
      ['Total Budget', totalBudget],
      ['Draft', statusCounts.DRAFT],
      ['Submitted', statusCounts.SUBMITTED],
      ['Under Review', statusCounts.UNDER_REVIEW],
      ['Approved', statusCounts.APPROVED],
      ['Final Approved', statusCounts.FINAL_APPROVED],
      ['Rejected', statusCounts.REJECTED],
      ['Returned for Revision', statusCounts.RETURNED_FOR_REVISION],
    ];
    summaryRows.forEach((r, i) => { summarySheet.getCell(`A${7 + i}`).value = r[0]; summarySheet.getCell(`B${7 + i}`).value = r[1]; });
    summarySheet.getColumn('A').width = 25;
    summarySheet.getColumn('B').width = 18;

    // ── Detail Sheet ──
    const detail = workbook.addWorksheet('BSC Plans');
    detail.columns = [
      { header: '#', key: 'no', width: 5 }, { header: 'Title', key: 'title', width: 30 },
      { header: 'Responsible Body', key: 'responsible', width: 22 },
      { header: 'Perspective', key: 'perspective', width: 20 },
      { header: 'Strategic Objective', key: 'strategicObjective', width: 30 },
      { header: 'KPI', key: 'kpiName', width: 25 },
      { header: 'Measurement Unit', key: 'measurementUnit', width: 16 },
      { header: 'Baseline', key: 'baseline', width: 12 },
      { header: 'Target', key: 'target', width: 12 },
      { header: 'Actual', key: 'actualResult', width: 12 },
      { header: 'Achievement %', key: 'achievement', width: 14 },
      { header: 'Weight', key: 'weight', width: 10 },
      { header: 'Budget (ETB)', key: 'budget', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Contributors', key: 'contributors', width: 30 },
    ];

    plans.forEach((p, i) => {
      const deptName = p.department?.name || '-';
      const contribList = (p.contributors || []).map(c => `${c.user.firstName} ${c.user.lastName} (${c.contributionPct}%)`).join(', ');
      detail.addRow({
        no: i + 1, title: p.title, responsible: deptName,
        perspective: p.perspective, strategicObjective: p.strategicObjective || '-',
        kpiName: p.kpiName, measurementUnit: p.measurementUnit || '-', baseline: p.baseline, target: p.target, actualResult: p.actualResult,
        achievement: calculateAchievementPercentage(p.actualResult, p.target) + '%',
        weight: p.weight + '%', budget: p.budget, status: p.status,
        contributors: contribList || '-',
      });
    });

    // Style header
    const headerRow = detail.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF136F63' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

    // Style number columns
    ['baseline', 'target', 'actualResult', 'budget'].forEach(k => {
      detail.getColumn(k).numFmt = '#,##0';
    });

    // The annual plan is deliberately laid out like the organisation's BSC workbook:
    // perspective sections, a July-to-June schedule, and quarter group headings.
    workbook.removeWorksheet(summarySheet.id);
    workbook.removeWorksheet(detail.id);
    const annual = workbook.addWorksheet('Annual BSC Plan', { views: [{ state: 'frozen', ySplit: 5, xSplit: 2 }] });
    const months = ['July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May', 'June'];
    const perspectiveNames = { FINANCIAL: 'Financial Perspectives', CUSTOMER: 'Customer Perspectives', INTERNAL_BUSINESS_PROCESS: 'Internal Business Process Perspectives', LEARNING_AND_GROWTH: 'Learning and Growth Perspectives' };
    const darkBlue = 'FF1F4E78';
    const lightBlue = 'FFD9EAF7';
    const border = { top: { style: 'thin', color: { argb: 'FF808080' } }, left: { style: 'thin', color: { argb: 'FF808080' } }, bottom: { style: 'thin', color: { argb: 'FF808080' } }, right: { style: 'thin', color: { argb: 'FF808080' } } };
    const planYear = plans.find(plan => plan.planYear)?.planYear || new Date().getFullYear();
    const reportName = req.params.type === 'department' ? `${info?.name || 'Department'} BSC Annual Plan` : req.params.type === 'individual' ? `${info?.firstName || ''} ${info?.lastName || ''} BSC Annual Plan` : 'Corporate BSC Annual Plan';

    annual.mergeCells('B1:X1'); annual.mergeCells('B2:X2'); annual.mergeCells('B3:X3');
    annual.getCell('B1').value = 'BSC MANAGEMENT SYSTEM';
    annual.getCell('B2').value = `FOR BUDGET YEAR ${planYear}/${planYear + 1}`;
    annual.getCell('B3').value = reportName;
    ['B1', 'B2', 'B3'].forEach(cellRef => {
      const cell = annual.getCell(cellRef);
      cell.font = { bold: true, size: cellRef === 'B1' ? 16 : 12, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: darkBlue } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    [1, 2, 3].forEach(rowNumber => { annual.getRow(rowNumber).height = 24; });

    const topHeaders = ['Perspectives', 'NO.', 'Strategic Themes, Objectives and Targets', 'Annual Weight in %', 'Measurement', 'Target', '1st Quarter', '', '', '2nd Quarter', '', '', '3rd Quarter', '', '', '4th Quarter', '', '', 'Summarized Objectives', 'Responsible Body', 'KPI', 'Plan Owner', 'Actual Result'];
    topHeaders.forEach((header, index) => { annual.getCell(4, index + 2).value = header; });
    months.forEach((month, index) => { annual.getCell(5, index + 8).value = month; });
    ['B4:B5', 'C4:C5', 'D4:D5', 'E4:E5', 'F4:F5', 'G4:G5', 'H4:J4', 'K4:M4', 'N4:P4', 'Q4:S4', 'T4:T5', 'U4:U5', 'V4:V5', 'W4:W5', 'X4:X5'].forEach(range => annual.mergeCells(range));
    for (let rowNumber = 4; rowNumber <= 5; rowNumber++) for (let column = 2; column <= 24; column++) {
      const cell = annual.getCell(rowNumber, column);
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: darkBlue } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = border;
    }
    annual.getRow(4).height = 36; annual.getRow(5).height = 30;
    [20, 8, 38, 13, 14, 16, ...Array(12).fill(13), 34, 23, 42, 24, 16].forEach((width, index) => { annual.getColumn(index + 2).width = width; });

    let outputRow = 6;
    Object.entries(perspectiveNames).forEach(([perspective, label]) => {
      const group = plans.filter(plan => plan.perspective === perspective);
      if (!group.length) return;
      annual.mergeCells(`B${outputRow}:X${outputRow}`);
      const section = annual.getCell(`B${outputRow}`);
      section.value = label; section.font = { bold: true }; section.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightBlue } }; section.alignment = { vertical: 'middle' }; section.border = border;
      annual.getRow(outputRow).height = 22; outputRow++;
      group.forEach((plan, index) => {
        const schedule = plan.monthlyTargets || {};
        const ownerName = plan.owner ? `${plan.owner.firstName} ${plan.owner.lastName}` : req.params.type === 'individual' && info ? `${info.firstName} ${info.lastName}` : '-';
        const values = [label, plan.objectiveNumber || String(index + 1), `${plan.strategicTheme ? `${plan.strategicTheme}: ` : ''}${plan.strategicObjective || plan.title}`, plan.weight, plan.measurementUnit || '-', plan.target, ...months.map(month => schedule[month] ?? ''), plan.strategicInitiative || '-', plan.department?.name || info?.department?.name || '-', plan.kpiName || '-', ownerName, plan.actualResult];
        values.forEach((value, index) => {
          const cell = annual.getCell(outputRow, index + 2);
          cell.value = value; cell.alignment = { vertical: 'top', wrapText: true }; cell.border = border;
          if (index === 3) cell.numFmt = '0.00';
          if ((index >= 5 && index <= 17) || index === 22) if (typeof value === 'number') cell.numFmt = '#,##0.00';
        });
        annual.getRow(outputRow).height = 42; outputRow++;
      });
    });
    annual.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.2, right: 0.2, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=bsc-${req.params.type}-report.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Excel error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/pdf/:type/:id?', authenticate, async (req, res) => {
  try {
    const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=bsc-${req.params.type}-report.pdf`);
    doc.pipe(res);

    const teal = '#136f63';
    const darkText = '#17211f';
    const mutedText = '#6c7774';

    let plans, info, contributions;
    if (req.params.type === 'individual') {
      info = await prisma.user.findUnique({ where: { id: req.params.id || req.user.id }, include: { department: true } });
      plans = await prisma.bSCPlan.findMany({ where: { ownerId: info.id }, include: { contributors: { include: { user: { select: { firstName: true, lastName: true } } } } } });
      contributions = await prisma.planContributor.findMany({ where: { userId: info.id }, include: { plan: { include: { owner: { select: { firstName: true, lastName: true } } } } } });
    } else if (req.params.type === 'department') {
      info = await prisma.department.findUnique({ where: { id: req.params.id } });
      plans = await prisma.bSCPlan.findMany({ where: { departmentId: req.params.id }, include: { owner: { select: { firstName: true, lastName: true } }, department: true, contributors: { include: { user: { select: { firstName: true, lastName: true } } } } } });
      contributions = null;
    } else {
      info = null;
      plans = await prisma.bSCPlan.findMany({ include: { owner: { select: { firstName: true, lastName: true } }, department: true, contributors: { include: { user: { select: { firstName: true, lastName: true } } } } } });
      contributions = null;
    }

    const avgAchievement = plans.length > 0 ? Math.round(plans.reduce((s, p) => s + calculateAchievementPercentage(p.actualResult, p.target), 0) / plans.length) : 0;
    const totalBudget = plans.reduce((s, p) => s + (p.budget || 0), 0);
    const statusCounts = { DRAFT: 0, SUBMITTED: 0, UNDER_REVIEW: 0, APPROVED: 0, FINAL_APPROVED: 0, REJECTED: 0, RETURNED_FOR_REVISION: 0 };
    plans.forEach(p => { if (statusCounts[p.status] !== undefined) statusCounts[p.status]++; });

    doc.rect(0, 0, doc.page.width, 80).fill(teal);
    doc.fill('#ffffff').fontSize(20).font('Helvetica-Bold').text('Balanced Scorecard — Performance Report', 50, 25, { align: 'center' });
    doc.fontSize(11).font('Helvetica').text(
      req.params.type === 'individual' ? 'Individual Performance Report' :
      req.params.type === 'department' ? 'Department Scorecard Report' : 'Corporate Scorecard Report',
      50, 52, { align: 'center' }
    );

    doc.fill(darkText).font('Helvetica-Bold').fontSize(12).text('Report Summary', 50, 100);
    doc.moveDown(0.5);

    const summaryY = doc.y;
    doc.fontSize(10).font('Helvetica');
    const summaryItems = [
      ['Report Type', req.params.type === 'individual' ? 'Individual Performance' : req.params.type === 'department' ? 'Department Scorecard' : 'Corporate Scorecard'],
    ];
    if (info) {
      summaryItems.push([req.params.type === 'individual' ? 'Employee' : 'Department',
        req.params.type === 'individual' ? `${info.firstName} ${info.lastName}${info.department ? ' (' + info.department.name + ')' : ''}` : info.name]);
    }
    summaryItems.push(
      ['Total Plans Owned', String(plans.length)],
      ['Average Achievement', `${avgAchievement}%`],
      ['Total Budget (ETB)', totalBudget.toLocaleString()],
      ['Final Approved', String(statusCounts.FINAL_APPROVED)],
    );

    if (req.params.type === 'individual' && contributions && contributions.length > 0) {
      const contribScore = Math.round(contributions.reduce((s, c) => s + calculateAchievementPercentage(c.plan.actualResult, c.plan.target) * (c.contributionPct / 100), 0));
      summaryItems.push(['Team Plans Contributed', String(contributions.length)]);
      summaryItems.push(['Contribution Score', `${contribScore}%`]);
    }

    summaryItems.forEach((item, i) => {
      const y = summaryY + i * 18;
      doc.font('Helvetica-Bold').text(item[0] + ':', 50, y, { continued: true, width: 200 });
      doc.font('Helvetica').text(' ' + item[1]);
    });

    doc.moveDown(1.5);
    doc.font('Helvetica-Bold').fontSize(12).fill(darkText).text('BSC Plans Detail', 50);
    doc.moveDown(0.5);

    const tableTop = doc.y;
    const colWidths = req.params.type === 'individual' ? [30, 110, 90, 100, 80, 55, 55, 55, 60, 50, 70, 75] : [30, 110, 80, 90, 100, 80, 55, 55, 55, 60, 50, 70, 75];
    const headers = req.params.type === 'individual' ? ['#', 'Title', 'Perspective', 'Strategic Objective', 'KPI', 'Baseline', 'Target', 'Actual', 'Achievement', 'Weight', 'Budget (ETB)', 'Status'] : ['#', 'Title', 'Department', 'Perspective', 'Strategic Objective', 'KPI', 'Baseline', 'Target', 'Actual', 'Achievement', 'Weight', 'Budget (ETB)', 'Status'];
    let x = 50;

    doc.rect(50, tableTop - 5, doc.page.width - 100, 22).fill(teal);
    doc.fill('#ffffff').font('Helvetica-Bold').fontSize(8);
    headers.forEach((h, i) => { doc.text(h, x + 3, tableTop, { width: colWidths[i], align: 'left' }); x += colWidths[i]; });

    doc.font('Helvetica').fontSize(8).fill(darkText);
    let rowY = tableTop + 22;
    const rowHeight = 18;
    const maxRows = Math.min(plans.length, 18);

    for (let i = 0; i < maxRows; i++) {
      const p = plans[i];
      const achievement = calculateAchievementPercentage(p.actualResult, p.target);
      if (rowY + rowHeight > doc.page.height - 50) {
        doc.addPage();
        x = 50;
        const newTableTop = 50;
        doc.rect(50, newTableTop - 5, doc.page.width - 100, 22).fill(teal);
        doc.fill('#ffffff').font('Helvetica-Bold').fontSize(8);
        headers.forEach((h, hi) => { doc.text(h, x + 3, newTableTop, { width: colWidths[hi], align: 'left' }); x += colWidths[hi]; });
        rowY = newTableTop + 22;
        doc.font('Helvetica').fontSize(8).fill(darkText);
      }

      if (i % 2 === 0) {
        doc.save().rect(50, rowY - 3, doc.page.width - 100, rowHeight).fill('#f9fafb').restore();
        doc.fill(darkText);
      }

      x = 50;
      const row = req.params.type === 'individual' ? [
        String(i + 1),
        p.title || '',
        p.perspective,
        p.strategicObjective || '-',
        p.kpiName || '',
        String(p.baseline),
        String(p.target),
        String(p.actualResult),
        `${achievement}%`,
        `${p.weight}%`,
        (p.budget || 0).toLocaleString(),
        p.status,
      ] : [
        String(i + 1),
        p.title || '',
        p.department?.name || '-',
        p.perspective,
        p.strategicObjective || '-',
        p.kpiName || '',
        String(p.baseline),
        String(p.target),
        String(p.actualResult),
        `${achievement}%`,
        `${p.weight}%`,
        (p.budget || 0).toLocaleString(),
        p.status,
      ];
      row.forEach((val, ci) => { doc.text(val, x + 3, rowY, { width: colWidths[ci], align: 'left', height: rowHeight, lineBreak: false }); x += colWidths[ci]; });
      rowY += rowHeight;
    }

    if (plans.length > maxRows) {
      doc.fontSize(9).fill(mutedText).text(`... and ${plans.length - maxRows} more plans`, 50, rowY + 5);
    }

    doc.fontSize(8).fill(mutedText);
    const footerY = doc.page.height - 30;
    doc.text(`Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 50, footerY, { align: 'left' });
    doc.text('BSC Management System — Insurance Corp', doc.page.width - 50, footerY, { align: 'right', width: doc.page.width - 100 });

    doc.end();
  } catch (error) {
    console.error('PDF error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/audit-trail', authenticate, async (req, res) => {
  try {
    const { startDate, endDate, userId, action } = req.query;
    const where = {};
    if (startDate || endDate) where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
    if (userId) where.userId = userId;
    if (action) where.action = action;
    const logs = await prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: 500 });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
