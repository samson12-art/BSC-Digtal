jest.mock('../src/utils/prisma', () => {
  const { mockDeep } = require('jest-mock-extended');
  return mockDeep();
});

process.env.JWT_SECRET = 'test-secret-key';
process.env.JWT_EXPIRES_IN = '1h';

const jwt = require('jsonwebtoken');
const request = require('supertest');
const prisma = require('../src/utils/prisma');
const app = require('../src/index');

describe('Departments Routes', () => {
  const ceoToken = jwt.sign({ userId: 'ceo-1', role: 'CEO' }, process.env.JWT_SECRET);
  const employeeToken = jwt.sign({ userId: 'emp-1', role: 'EMPLOYEE' }, process.env.JWT_SECRET);
  const mockCEO = {
    id: 'ceo-1', firstName: 'CEO', lastName: 'One', role: 'CEO',
    departmentId: null, managerId: null, isActive: true,
    department: null, manager: null,
  };
  const mockEmployee = {
    id: 'emp-1', firstName: 'Emp', lastName: 'One', role: 'EMPLOYEE',
    departmentId: 'dept-1', managerId: 'mgr-1', isActive: true,
    department: { id: 'dept-1', name: 'Underwriting' }, manager: null,
  };
  const mockDepartment = {
    id: 'dept-1', name: 'Underwriting', description: 'Handles insurance underwriting',
    createdAt: new Date(), updatedAt: new Date(),
    _count: { employees: 10, bscPlans: 20 },
  };

  beforeEach(() => { jest.clearAllMocks(); });

  describe('GET /api/departments', () => {
    it('should return all departments', async () => {
      prisma.user.findUnique.mockResolvedValue(mockCEO);
      prisma.department.findMany.mockResolvedValue([mockDepartment]);

      const res = await request(app)
        .get('/api/departments')
        .set('Authorization', `Bearer ${ceoToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('POST /api/departments', () => {
    it('should create a department as CEO', async () => {
      prisma.user.findUnique.mockResolvedValue(mockCEO);
      prisma.department.create.mockResolvedValue(mockDepartment);
      prisma.auditLog.create.mockResolvedValue({});

      const res = await request(app)
        .post('/api/departments')
        .set('Authorization', `Bearer ${ceoToken}`)
        .send({ name: 'Underwriting', description: 'Handles insurance underwriting' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Underwriting');
    });

    it('should return 403 for employees', async () => {
      prisma.user.findUnique.mockResolvedValue(mockEmployee);

      const res = await request(app)
        .post('/api/departments')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ name: 'New Dept' });

      expect(res.status).toBe(403);
    });

    it('should return 400 on missing name', async () => {
      prisma.user.findUnique.mockResolvedValue(mockCEO);

      const res = await request(app)
        .post('/api/departments')
        .set('Authorization', `Bearer ${ceoToken}`)
        .send({ description: 'No name' });

      expect(res.status).toBe(400);
    });

    it('should return 400 on duplicate name', async () => {
      prisma.user.findUnique.mockResolvedValue(mockCEO);
      prisma.department.create.mockRejectedValue({ code: 'P2002' });

      const res = await request(app)
        .post('/api/departments')
        .set('Authorization', `Bearer ${ceoToken}`)
        .send({ name: 'Underwriting' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Department name already exists');
    });
  });
});

describe('Divisions Routes', () => {
  const ceoToken = jwt.sign({ userId: 'ceo-1', role: 'CEO' }, process.env.JWT_SECRET);
  const departmentId = '11111111-1111-4111-8111-111111111111';
  const mockCEO = {
    id: 'ceo-1', firstName: 'CEO', lastName: 'One', role: 'CEO',
    departmentId: null, managerId: null, isActive: true, department: null, manager: null,
  };
  const mockDivision = {
    id: '22222222-2222-4222-8222-222222222222', name: 'Corporate Claims Division',
    description: 'Manages corporate claims', departmentId,
    department: { id: departmentId, name: 'Claims' }, _count: { employees: 0 },
  };

  beforeEach(() => { jest.clearAllMocks(); });

  it('returns divisions for an authenticated user', async () => {
    prisma.user.findUnique.mockResolvedValue(mockCEO);
    prisma.division.findMany.mockResolvedValue([mockDivision]);

    const res = await request(app).get('/api/divisions').set('Authorization', `Bearer ${ceoToken}`);

    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe('Corporate Claims Division');
  });

  it('creates a division for a valid department as CEO', async () => {
    prisma.user.findUnique.mockResolvedValue(mockCEO);
    prisma.department.findUnique.mockResolvedValue({ id: departmentId });
    prisma.division.create.mockResolvedValue(mockDivision);
    prisma.auditLog.create.mockResolvedValue({});

    const res = await request(app)
      .post('/api/divisions')
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ name: 'Corporate Claims Division', departmentId, description: 'Manages corporate claims' });

    expect(res.status).toBe(201);
    expect(res.body.departmentId).toBe(departmentId);
  });

  it('rejects a division assigned to a nonexistent department', async () => {
    prisma.user.findUnique.mockResolvedValue(mockCEO);
    prisma.department.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/divisions')
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ name: 'Corporate Claims Division', departmentId });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Selected department does not exist.');
  });
});

describe('Approvals Routes', () => {
  const departmentManagerToken = jwt.sign({ userId: 'mgr-1', role: 'DEPARTMENT_MANAGER' }, process.env.JWT_SECRET);
  const ceoToken = jwt.sign({ userId: 'ceo-1', role: 'CEO' }, process.env.JWT_SECRET);
  const mockDepartmentManager = {
    id: 'mgr-1', firstName: 'Manager', lastName: 'One', role: 'DEPARTMENT_MANAGER',
    departmentId: 'dept-1', managerId: 'exec-1', isActive: true,
    department: { id: 'dept-1', name: 'Underwriting' }, manager: null,
  };
  const mockCEO = {
    id: 'ceo-1', firstName: 'CEO', lastName: 'One', role: 'CEO',
    departmentId: null, managerId: null, isActive: true,
    department: null, manager: null,
  };
  const mockPlan = {
    id: 'plan-1', title: 'Test Plan', status: 'SUBMITTED',
    ownerId: 'emp-1', departmentId: 'dept-1',
    owner: { id: 'emp-1', firstName: 'Emp', lastName: 'One', role: 'EMPLOYEE' },
    department: { id: 'dept-1', name: 'Underwriting' },
  };

  beforeEach(() => { jest.clearAllMocks(); });

  describe('POST /api/approvals/:planId/approve', () => {
    it('should approve a submitted plan', async () => {
      prisma.user.findUnique.mockResolvedValue(mockDepartmentManager);
      prisma.bSCPlan.findUnique.mockResolvedValue(mockPlan);
      prisma.approvalHistory.create.mockResolvedValue({ id: 'approval-1' });
      prisma.bSCPlan.update.mockResolvedValue({ ...mockPlan, status: 'UNDER_REVIEW' });
      prisma.notification.create.mockResolvedValue({});
      prisma.auditLog.create.mockResolvedValue({});

      const res = await request(app)
        .post('/api/approvals/plan-1/approve')
        .set('Authorization', `Bearer ${departmentManagerToken}`)
        .send({ comments: 'Looks good' });

      expect(res.status).toBe(200);
      expect(res.body.plan.status).toBe('UNDER_REVIEW');
    });

    it('should final-approve when CEO approves', async () => {
      prisma.user.findUnique.mockResolvedValue(mockCEO);
      prisma.bSCPlan.findUnique.mockResolvedValue({ ...mockPlan, status: 'UNDER_REVIEW' });
      prisma.approvalHistory.create.mockResolvedValue({ id: 'approval-2' });
      prisma.bSCPlan.update.mockResolvedValue({ ...mockPlan, status: 'FINAL_APPROVED' });
      prisma.notification.create.mockResolvedValue({});
      prisma.auditLog.create.mockResolvedValue({});

      const res = await request(app)
        .post('/api/approvals/plan-1/approve')
        .set('Authorization', `Bearer ${ceoToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.plan.status).toBe('FINAL_APPROVED');
    });

    it('should return 400 if plan is not reviewable', async () => {
      prisma.user.findUnique.mockResolvedValue(mockDepartmentManager);
      prisma.bSCPlan.findUnique.mockResolvedValue({ ...mockPlan, status: 'DRAFT' });

      const res = await request(app)
        .post('/api/approvals/plan-1/approve')
        .set('Authorization', `Bearer ${departmentManagerToken}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/approvals/:planId/reject', () => {
    it('should reject a plan with reason', async () => {
      prisma.user.findUnique.mockResolvedValue(mockDepartmentManager);
      prisma.bSCPlan.findUnique.mockResolvedValue(mockPlan);
      prisma.approvalHistory.create.mockResolvedValue({ id: 'approval-3' });
      prisma.bSCPlan.update.mockResolvedValue({ ...mockPlan, status: 'REJECTED' });
      prisma.notification.create.mockResolvedValue({});
      prisma.auditLog.create.mockResolvedValue({});

      const res = await request(app)
        .post('/api/approvals/plan-1/reject')
        .set('Authorization', `Bearer ${departmentManagerToken}`)
        .send({ comments: 'Does not meet strategic alignment requirements' });

      expect(res.status).toBe(200);
      expect(res.body.plan.status).toBe('REJECTED');
    });

    it('should return 400 without rejection reason', async () => {
      prisma.user.findUnique.mockResolvedValue(mockDepartmentManager);

      const res = await request(app)
        .post('/api/approvals/plan-1/reject')
        .set('Authorization', `Bearer ${departmentManagerToken}`)
        .send({ comments: '' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/approvals/:planId/return', () => {
    it('should return plan for revision', async () => {
      prisma.user.findUnique.mockResolvedValue(mockDepartmentManager);
      prisma.bSCPlan.findUnique.mockResolvedValue(mockPlan);
      prisma.approvalHistory.create.mockResolvedValue({ id: 'approval-4' });
      prisma.bSCPlan.update.mockResolvedValue({ ...mockPlan, status: 'RETURNED_FOR_REVISION' });
      prisma.notification.create.mockResolvedValue({});
      prisma.auditLog.create.mockResolvedValue({});

      const res = await request(app)
        .post('/api/approvals/plan-1/return')
        .set('Authorization', `Bearer ${departmentManagerToken}`)
        .send({ comments: 'Please revise the KPI targets to be more realistic' });

      expect(res.status).toBe(200);
      expect(res.body.plan.status).toBe('RETURNED_FOR_REVISION');
    });

    it('should return 400 without comments', async () => {
      prisma.user.findUnique.mockResolvedValue(mockDepartmentManager);

      const res = await request(app)
        .post('/api/approvals/plan-1/return')
        .set('Authorization', `Bearer ${departmentManagerToken}`)
        .send({ comments: '' });

      expect(res.status).toBe(400);
    });
  });
});
