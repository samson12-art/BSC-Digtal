const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');
  
  const password = await bcrypt.hash('Password123!', 12);
  const ceoPassword = await bcrypt.hash(process.env.INITIAL_CEO_PASSWORD || 'Password123!', 12);
  const ceoEmail = (process.env.INITIAL_CEO_EMAIL || 'samsonyeshanew@gwmail.com').toLowerCase();
  // Seeds are run more than once during development, so use the unique fields
  // in the schema to update existing records instead of creating duplicates.
  const upsertUser = ({ data }) => prisma.user.upsert({
    where: { email: data.email },
    update: data,
    create: data,
  });
  
  const departments = await Promise.all([
    prisma.department.upsert({ where: { name: 'Executive Office' }, update: { description: 'Executive leadership and strategic direction' }, create: { name: 'Executive Office', description: 'Executive leadership and strategic direction' } }),
    prisma.department.upsert({ where: { name: 'Underwriting' }, update: { description: 'Risk assessment and policy pricing' }, create: { name: 'Underwriting', description: 'Risk assessment and policy pricing' } }),
    prisma.department.upsert({ where: { name: 'Claims' }, update: { description: 'Claims processing and settlement' }, create: { name: 'Claims', description: 'Claims processing and settlement' } }),
    prisma.department.upsert({ where: { name: 'Sales & Marketing' }, update: { description: 'Business development and marketing' }, create: { name: 'Sales & Marketing', description: 'Business development and marketing' } }),
    prisma.department.upsert({ where: { name: 'Finance' }, update: { description: 'Financial management and reporting' }, create: { name: 'Finance', description: 'Financial management and reporting' } }),
    prisma.department.upsert({ where: { name: 'Human Resources' }, update: { description: 'People management and development' }, create: { name: 'Human Resources', description: 'People management and development' } }),
    prisma.department.upsert({ where: { name: 'IT' }, update: { description: 'Technology infrastructure and development' }, create: { name: 'IT', description: 'Technology infrastructure and development' } }),
    prisma.department.upsert({ where: { name: 'Customer Service' }, update: { description: 'Customer support and relations' }, create: { name: 'Customer Service', description: 'Customer support and relations' } }),
    prisma.department.upsert({ where: { name: 'Actuarial' }, update: { description: 'Statistical analysis and risk modeling' }, create: { name: 'Actuarial', description: 'Statistical analysis and risk modeling' } }),
    prisma.department.upsert({ where: { name: 'Legal & Compliance' }, update: { description: 'Legal affairs and regulatory compliance' }, create: { name: 'Legal & Compliance', description: 'Legal affairs and regulatory compliance' } }),
  ]);

  const board = await upsertUser({
    data: { firstName: 'Alemayehu', lastName: 'Bekele', email: 'board@insurance.com', password, role: 'BOARD_MEMBER' }
  });

  const ceoData = { firstName: 'Samson', lastName: 'Yeshanew', email: ceoEmail, password: ceoPassword, role: 'CEO', departmentId: departments[0].id, managerId: board.id, emailVerifiedAt: null, emailVerificationToken: null, emailVerificationExpiresAt: null };
  const legacyCeo = await prisma.user.findUnique({ where: { email: 'ceo@insurance.com' } });
  const configuredCeo = await prisma.user.findUnique({ where: { email: ceoEmail } });
  const ceo = legacyCeo && !configuredCeo
    ? await prisma.user.update({ where: { id: legacyCeo.id }, data: ceoData })
    : await upsertUser({ data: ceoData });

  const execManagers = [];
  const executiveData = [
    { firstName: 'Dawit', lastName: 'Tadesse', email: 'exec.uw@insurance.com', deptIdx: 1 },
    { firstName: 'Sara', lastName: 'Yilma', email: 'exec.claims@insurance.com', deptIdx: 2 },
    { firstName: 'Abel', lastName: 'Girma', email: 'exec.sales@insurance.com', deptIdx: 3 },
    { firstName: 'Hana', lastName: 'Abebe', email: 'exec.finance@insurance.com', deptIdx: 4 },
    { firstName: 'Kidus', lastName: 'Tamrat', email: 'exec.hr@insurance.com', deptIdx: 5 },
    { firstName: 'Naomi', lastName: 'Berhanu', email: 'exec.it@insurance.com', deptIdx: 6 },
  ];
  
  for (const exec of executiveData) {
    const u = await upsertUser({
      data: { firstName: exec.firstName, lastName: exec.lastName, email: exec.email, password, role: 'EXECUTIVE_MANAGER', departmentId: departments[exec.deptIdx].id, managerId: ceo.id }
    });
    execManagers.push(u);
  }

  const deptManagers = [];
  const deptManagerData = [
    { firstName: 'Yonas', lastName: 'Alemayehu', email: 'mgr.uw1@insurance.com', deptIdx: 1 },
    { firstName: 'Ruth', lastName: 'Gebremedhin', email: 'mgr.claims1@insurance.com', deptIdx: 2 },
    { firstName: 'Samuel', lastName: 'Worku', email: 'mgr.sales1@insurance.com', deptIdx: 3 },
    { firstName: 'Lidya', lastName: 'Assefa', email: 'mgr.finance1@insurance.com', deptIdx: 4 },
    { firstName: 'Meron', lastName: 'Tadesse', email: 'mgr.hr1@insurance.com', deptIdx: 5 },
    { firstName: 'Daniel', lastName: 'Kebede', email: 'mgr.it1@insurance.com', deptIdx: 6 },
    { firstName: 'Beimnet', lastName: 'Zewde', email: 'mgr.cs@insurance.com', deptIdx: 7 },
    { firstName: 'Nardos', lastName: 'Getachew', email: 'mgr.actuarial@insurance.com', deptIdx: 8 },
    { firstName: 'Ephrem', lastName: 'Haile', email: 'mgr.legal@insurance.com', deptIdx: 9 },
  ];
  
  for (const mgr of deptManagerData) {
    const u = await upsertUser({
      data: { firstName: mgr.firstName, lastName: mgr.lastName, email: mgr.email, password, role: 'DEPARTMENT_MANAGER', departmentId: departments[mgr.deptIdx].id, managerId: execManagers[Math.min(mgr.deptIdx - 1, execManagers.length - 1)].id }
    });
    deptManagers.push(u);
  }

  const employees = [];
  const employeeData = [
    { firstName: 'Aisha', lastName: 'Mohammed', email: 'emp.uw1@insurance.com', deptIdx: 1 },
    { firstName: 'Tewodros', lastName: 'Aschenaki', email: 'emp.uw2@insurance.com', deptIdx: 1 },
    { firstName: 'Liya', lastName: 'Gebreyesus', email: 'emp.uw3@insurance.com', deptIdx: 1 },
    { firstName: 'Dennis', lastName: 'Ochieng', email: 'emp.claims1@insurance.com', deptIdx: 2 },
    { firstName: 'Fiona', lastName: 'Wanjiku', email: 'emp.claims2@insurance.com', deptIdx: 2 },
    { firstName: 'Yonatan', lastName: 'Kebede', email: 'emp.sales1@insurance.com', deptIdx: 3 },
    { firstName: 'Eleni', lastName: 'Hailemariam', email: 'emp.sales2@insurance.com', deptIdx: 3 },
    { firstName: 'Chris', lastName: 'Omondi', email: 'emp.cs1@insurance.com', deptIdx: 7 },
    { firstName: 'Helen', lastName: 'Beyene', email: 'emp.cs2@insurance.com', deptIdx: 7 },
    { firstName: 'Samson', lastName: 'Lemma', email: 'emp.fin1@insurance.com', deptIdx: 4 },
  ];
  
  for (const emp of employeeData) {
    const u = await upsertUser({
      data: { firstName: emp.firstName, lastName: emp.lastName, email: emp.email, password, role: 'EMPLOYEE', departmentId: departments[emp.deptIdx].id, managerId: deptManagers[emp.deptIdx - 1].id }
    });
    employees.push(u);
  }

  const perspectives = ['FINANCIAL', 'CUSTOMER', 'INTERNAL_BUSINESS_PROCESS', 'LEARNING_AND_GROWTH'];
  const statuses = ['DRAFT', 'SUBMITTED', 'APPROVED', 'FINAL_APPROVED', 'RETURNED_FOR_REVISION'];
  
  const planTemplates = [
    { title: 'Increase Net Premium Income', perspective: 'FINANCIAL', objective: 'Grow premium income by 15% year-over-year', kpi: 'Net Premium Income', formula: '(Current Premium - Previous Premium) / Previous Premium * 100', baseline: 50000000, target: 57500000, weight: 20, budget: 5000000, initiative: 'Expand product portfolio and enter new market segments' },
    { title: 'Improve Loss Ratio', perspective: 'FINANCIAL', objective: 'Reduce loss ratio to below 65%', kpi: 'Loss Ratio', formula: 'Claims Paid / Premium Earned * 100', baseline: 72, target: 65, weight: 15, budget: 2000000, initiative: 'Enhance underwriting standards and risk selection' },
    { title: 'Increase Customer Satisfaction Score', perspective: 'CUSTOMER', objective: 'Achieve 90% customer satisfaction rating', kpi: 'CSAT Score', formula: 'Sum of Satisfaction Ratings / Total Responses * 100', baseline: 75, target: 90, weight: 20, budget: 1500000, initiative: 'Implement customer feedback system and service improvements' },
    { title: 'Reduce Policy Processing Time', perspective: 'CUSTOMER', objective: 'Process new policies within 24 hours', kpi: 'Average Processing Time', formula: 'Total Processing Hours / Number of Policies', baseline: 48, target: 24, weight: 15, budget: 3000000, initiative: 'Automate underwriting and policy issuance workflow' },
    { title: 'Improve Claims Settlement Speed', perspective: 'INTERNAL_BUSINESS_PROCESS', objective: 'Settle 80% of claims within 14 days', kpi: 'Claims Settlement Time', formula: 'Claims Settled Within 14 Days / Total Claims * 100', baseline: 60, target: 80, weight: 20, budget: 2500000, initiative: 'Deploy claims management system and streamline settlement process' },
    { title: 'Enhance Digital Channels', perspective: 'INTERNAL_BUSINESS_PROCESS', objective: 'Achieve 40% digital policy purchases', kpi: 'Digital Channel Adoption', formula: 'Digital Policies / Total Policies * 100', baseline: 15, target: 40, weight: 15, budget: 8000000, initiative: 'Build mobile app and online self-service portal' },
    { title: 'Employee Training Hours', perspective: 'LEARNING_AND_GROWTH', objective: 'Provide 40 training hours per employee annually', kpi: 'Training Hours per Employee', formula: 'Total Training Hours / Number of Employees', baseline: 20, target: 40, weight: 15, budget: 3000000, initiative: 'Establish training academy and e-learning platform' },
    { title: 'Reduce Employee Turnover', perspective: 'LEARNING_AND_GROWTH', objective: 'Keep annual turnover below 10%', kpi: 'Employee Turnover Rate', formula: 'Voluntary Separations / Average Headcount * 100', baseline: 18, target: 10, weight: 10, budget: 2000000, initiative: 'Implement retention programs and career development paths' },
  ];

  const createdPlans = [];
  for (let i = 0; i < employees.length; i++) {
    for (let j = 0; j < 2; j++) {
      const template = planTemplates[(i * 2 + j) % planTemplates.length];
      const actualMultiplier = 0.5 + Math.random() * 0.7;
      const title = `${template.title} - ${employees[i].firstName}`;
      const existingPlan = await prisma.bSCPlan.findFirst({
        where: { title, ownerId: employees[i].id }
      });

      if (existingPlan) {
        createdPlans.push(existingPlan);
        continue;
      }

      const plan = await prisma.bSCPlan.create({
        data: {
          title,
          description: `${template.objective} - Individual plan for ${employees[i].firstName} ${employees[i].lastName}`,
          perspective: template.perspective,
          strategicObjective: template.objective,
          kpiName: template.kpi,
          kpiFormula: template.formula,
          baseline: template.baseline,
          target: template.target,
          actualResult: Math.round(template.target * actualMultiplier),
          weight: template.weight,
          strategicInitiative: template.initiative,
          budget: template.budget,
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-12-31'),
          status: statuses[Math.floor(Math.random() * statuses.length)],
          ownerId: employees[i].id,
          departmentId: employees[i].departmentId,
          versions: { create: { version: 1, data: { title: template.title } } }
        }
      });
      createdPlans.push(plan);
    }
  }

  console.log(`Created ${departments.length} departments`);
  console.log(`Created 1 Board Member, 1 CEO`);
  console.log(`Created ${execManagers.length} Executive Managers`);
  console.log(`Created ${deptManagers.length} Department Managers`);
  console.log(`Created ${employees.length} Employees`);
  console.log(`Created ${createdPlans.length} BSC Plans`);
  console.log('Seeding complete!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
