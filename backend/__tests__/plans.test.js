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

describe('Plans Routes', () => {
  const employeeToken = jwt.sign({ userId: 'emp-1', role: 'EMPLOYEE' }, process.env.JWT_SECRET);
  const managerToken = jwt.sign({ userId: 'mgr-1', role: 'DEPARTMENT_MANAGER' }, process.env.JWT_SECRET);
  const ceoToken = jwt.sign({ userId: 'ceo-1', role: 'CEO' }, process.env.JWT_SECRET);

  const mockEmployee = {
    id: 'emp-1', firstName: 'Emp', lastName: 'One', role: 'EMPLOYEE',
    departmentId: 'dept-1', managerId: 'mgr-1', isActive: true,
    department: { id: 'dept-1', name: 'Underwriting' }, manager: null,
  };
  const mockManager = {
    id: 'mgr-1', firstName: 'Mgr', lastName: 'One', role: 'DEPARTMENT_MANAGER',
    departmentId: 'dept-1', managerId: 'ceo-1', isActive: true,
    department: { id: 'dept-1', name: 'Underwriting' }, manager: null,
  };
  const mockCEO = {
    id: 'ceo-1', firstName: 'CEO', lastName: 'One', role: 'CEO',
    departmentId: null, managerId: null, isActive: true,
    department: null, manager: null,
  };

  const mockPlan = {
    id: 'plan-1', title: 'Test Plan', description: 'A test plan',
    perspective: 'FINANCIAL', status: 'DRAFT',
    strategicObjective: 'Increase revenue', kpiName: 'Revenue Growth',
    kpiFormula: 'new/old*100', measurementUnit: '%',
    baseline: 100, target: 200, actualResult: 150, weight: 25,
    strategicInitiative: 'Marketing push', budget: 50000,
    startDate: new Date(), endDate: new Date(),
    version: 1, ownerId: 'emp-1', departmentId: 'dept-1',
    parentPlanId: null, createdAt: new Date(), updatedAt: new Date(),
    owner: { id: 'emp-1', firstName: 'Emp', lastName: 'One', role: 'EMPLOYEE' },
    department: { id: 'dept-1', name: 'Underwriting' },
    parentPlan: null, childPlans: [],
    approvalHistory: [], attachments: [], comments: [], versions: [],
    _count: { approvalHistory: 0, attachments: 0, comments: 0, childPlans: 0 },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/plans', () => {
    it('should create a new plan', async () => {
      prisma.user.findUnique.mockResolvedValue(mockEmployee);
      prisma.bSCPlan.create.mockResolvedValue(mockPlan);
      prisma.auditLog.create.mockResolvedValue({});

      const res = await request(app)
        .post('/api/plans')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          title: 'Test Plan', perspective: 'FINANCIAL',
          strategicObjective: 'Increase revenue', kpiName: 'Revenue Growth',
          target: 200,
        });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Test Plan');
    });

    it('should return 400 on missing required fields', async () => {
      prisma.user.findUnique.mockResolvedValue(mockEmployee);

      const res = await request(app)
        .post('/api/plans')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ title: 'Plan without perspective' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should return 400 on invalid perspective', async () => {
      prisma.user.findUnique.mockResolvedValue(mockEmployee);

      const res = await request(app)
        .post('/api/plans')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          title: 'Test', perspective: 'INVALID',
          strategicObjective: 'Test', kpiName: 'Test', target: 100,
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 on negative target', async () => {
      prisma.user.findUnique.mockResolvedValue(mockEmployee);

      const res = await request(app)
        .post('/api/plans')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          title: 'Test', perspective: 'FINANCIAL',
          strategicObjective: 'Test', kpiName: 'Test', target: -50,
        });

      expect(res.status).toBe(400);
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .post('/api/plans')
        .send({ title: 'Test', perspective: 'FINANCIAL', strategicObjective: 'Test', kpiName: 'Test', target: 100 });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/plans', () => {
    it('should return plans scoped to employee', async () => {
      prisma.user.findUnique.mockResolvedValue(mockEmployee);
      prisma.bSCPlan.findMany.mockResolvedValue([mockPlan]);

      const res = await request(app)
        .get('/api/plans')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should return all plans for CEO', async () => {
      prisma.user.findUnique.mockResolvedValue(mockCEO);
      prisma.bSCPlan.findMany.mockResolvedValue([mockPlan]);

      const res = await request(app)
        .get('/api/plans')
        .set('Authorization', `Bearer ${ceoToken}`);

      expect(res.status).toBe(200);
    });

    it('should filter by perspective', async () => {
      prisma.user.findUnique.mockResolvedValue(mockCEO);
      prisma.bSCPlan.findMany.mockResolvedValue([mockPlan]);

      const res = await request(app)
        .get('/api/plans?perspective=FINANCIAL')
        .set('Authorization', `Bearer ${ceoToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/plans/:id', () => {
    it('should return plan detail', async () => {
      prisma.user.findUnique.mockResolvedValue(mockEmployee);
      prisma.bSCPlan.findUnique.mockResolvedValue(mockPlan);

      const res = await request(app)
        .get('/api/plans/plan-1')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('plan-1');
    });

    it('should return 404 for non-existent plan', async () => {
      prisma.user.findUnique.mockResolvedValue(mockEmployee);
      prisma.bSCPlan.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/plans/non-existent')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/plans/:id', () => {
    it('should delete draft plan by owner', async () => {
      prisma.user.findUnique.mockResolvedValue(mockEmployee);
      prisma.bSCPlan.findUnique.mockResolvedValue(mockPlan);
      prisma.bSCPlan.delete.mockResolvedValue({});

      const res = await request(app)
        .delete('/api/plans/plan-1')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Plan deleted successfully');
    });

    it('should return 403 when deleting non-owner plan', async () => {
      prisma.user.findUnique.mockResolvedValue(mockManager);
      prisma.bSCPlan.findUnique.mockResolvedValue(mockPlan);

      const res = await request(app)
        .delete('/api/plans/plan-1')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(403);
    });

    it('should return 403 when deleting non-draft plan', async () => {
      prisma.user.findUnique.mockResolvedValue(mockEmployee);
      prisma.bSCPlan.findUnique.mockResolvedValue({ ...mockPlan, status: 'SUBMITTED' });

      const res = await request(app)
        .delete('/api/plans/plan-1')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/plans/:id/comments', () => {
    it('should add a comment', async () => {
      prisma.user.findUnique.mockResolvedValue(mockEmployee);
      prisma.planComment.create.mockResolvedValue({
        id: 'comment-1', content: 'Great plan!', planId: 'plan-1',
        userId: 'emp-1', createdAt: new Date(),
        user: { firstName: 'Emp', lastName: 'One', role: 'EMPLOYEE' },
      });
      prisma.bSCPlan.findUnique.mockResolvedValue(mockPlan);

      const res = await request(app)
        .post('/api/plans/plan-1/comments')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ content: 'Great plan!' });

      expect(res.status).toBe(201);
      expect(res.body.content).toBe('Great plan!');
    });

    it('should return 400 on empty comment', async () => {
      prisma.user.findUnique.mockResolvedValue(mockEmployee);

      const res = await request(app)
        .post('/api/plans/plan-1/comments')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ content: '' });

      expect(res.status).toBe(400);
    });
  });
});
