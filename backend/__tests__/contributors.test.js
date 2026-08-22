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

describe('Contributor Routes', () => {
  const ownerToken = jwt.sign({ userId: 'owner-1', role: 'EMPLOYEE' }, process.env.JWT_SECRET);
  const otherToken = jwt.sign({ userId: 'other-1', role: 'EMPLOYEE' }, process.env.JWT_SECRET);
  const ceoToken = jwt.sign({ userId: 'ceo-1', role: 'CEO' }, process.env.JWT_SECRET);

  const mockUsers = {
    'owner-1': { id: 'owner-1', firstName: 'John', lastName: 'Doe', role: 'EMPLOYEE', departmentId: 'dept-1', managerId: null, isActive: true, department: { id: 'dept-1', name: 'Finance' }, manager: null },
    'other-1': { id: 'other-1', firstName: 'Jane', lastName: 'Smith', role: 'EMPLOYEE', departmentId: 'dept-1', managerId: null, isActive: true, department: { id: 'dept-1', name: 'IT' }, manager: null },
    'ceo-1': { id: 'ceo-1', firstName: 'CEO', lastName: 'One', role: 'CEO', departmentId: null, managerId: null, isActive: true, department: null, manager: null },
  };

  const mockPlan = {
    id: 'plan-1', title: 'Test Plan', ownerId: 'owner-1', status: 'DRAFT', perspective: 'FINANCIAL',
    strategicObjective: 'Increase revenue', kpiName: 'Revenue Growth', target: 100, actualResult: 80,
    weight: 30, budget: 50000, baseline: 60, departmentId: 'dept-1',
    createdAt: new Date(), updatedAt: new Date(),
  };

  const mockContributor = {
    id: 'contrib-1', planId: 'plan-1', userId: 'other-1', contributionPct: 30, role: 'CONTRIBUTOR',
    user: { id: 'other-1', firstName: 'Jane', lastName: 'Smith', email: 'jane@test.com', role: 'EMPLOYEE', department: { name: 'IT' } },
    plan: { id: 'plan-1', title: 'Test Plan', perspective: 'FINANCIAL', status: 'DRAFT', target: 100, actualResult: 80, weight: 30, owner: { firstName: 'John', lastName: 'Doe' }, department: { name: 'Finance' }, contributors: [] },
    createdAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockImplementation(async ({ where }) => mockUsers[where.id] || null);
  });

  describe('GET /api/contributors/plan/:planId', () => {
    it('should return contributors for a plan', async () => {
      prisma.planContributor.findMany.mockResolvedValue([mockContributor]);

      const res = await request(app)
        .get('/api/contributors/plan/plan-1')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].user.firstName).toBe('Jane');
    });

    it('should return 401 without auth token', async () => {
      const res = await request(app)
        .get('/api/contributors/plan/plan-1');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/contributors/plan/:planId', () => {
    it('should add a contributor as plan owner', async () => {
      prisma.bSCPlan.findUnique.mockResolvedValue(mockPlan);
      prisma.planContributor.findUnique.mockResolvedValue(null);
      prisma.planContributor.findMany.mockResolvedValue([]);
      prisma.planContributor.create.mockResolvedValue(mockContributor);
      prisma.auditLog.create.mockResolvedValue({});

      const res = await request(app)
        .post('/api/contributors/plan/plan-1')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ userId: 'other-1', contributionPct: 30, role: 'CONTRIBUTOR' });

      expect(res.status).toBe(201);
      expect(res.body.user.firstName).toBe('Jane');
    });

    it('should return 403 for non-owner non-executive adding contributor', async () => {
      prisma.bSCPlan.findUnique.mockResolvedValue(mockPlan);

      const res = await request(app)
        .post('/api/contributors/plan/plan-1')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ userId: 'ceo-1', contributionPct: 30, role: 'CONTRIBUTOR' });

      expect(res.status).toBe(403);
    });

    it('should return 400 for duplicate contributor', async () => {
      prisma.bSCPlan.findUnique.mockResolvedValue(mockPlan);
      prisma.planContributor.findUnique.mockResolvedValue(mockContributor);

      const res = await request(app)
        .post('/api/contributors/plan/plan-1')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ userId: 'other-1', contributionPct: 30, role: 'CONTRIBUTOR' });

      expect(res.status).toBe(400);
    });

    it('should return 400 for exceeding 100% total contribution', async () => {
      prisma.bSCPlan.findUnique.mockResolvedValue(mockPlan);
      prisma.planContributor.findUnique.mockResolvedValue(null);
      prisma.planContributor.findMany.mockResolvedValue([{ ...mockContributor, contributionPct: 80 }]);

      const res = await request(app)
        .post('/api/contributors/plan/plan-1')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ userId: 'other-1', contributionPct: 30, role: 'CONTRIBUTOR' });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/contributors/:id', () => {
    it('should update a contributor', async () => {
      prisma.planContributor.findUnique.mockResolvedValue({ ...mockContributor, plan: { ...mockPlan } });
      prisma.planContributor.findMany.mockResolvedValue([]);
      prisma.planContributor.update.mockResolvedValue({ ...mockContributor, contributionPct: 40 });

      const res = await request(app)
        .put('/api/contributors/contrib-1')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ contributionPct: 40 });

      expect(res.status).toBe(200);
      expect(res.body.contributionPct).toBe(40);
    });

    it('should return 404 for non-existent contributor', async () => {
      prisma.planContributor.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .put('/api/contributors/nonexistent')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ contributionPct: 40 });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/contributors/:id', () => {
    it('should remove a contributor', async () => {
      prisma.planContributor.findUnique.mockResolvedValue({ ...mockContributor, plan: mockPlan });
      prisma.planContributor.delete.mockResolvedValue(mockContributor);
      prisma.auditLog.create.mockResolvedValue({});

      const res = await request(app)
        .delete('/api/contributors/contrib-1')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/removed/i);
    });

    it('should return 404 for non-existent contributor', async () => {
      prisma.planContributor.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .delete('/api/contributors/nonexistent')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/contributors/my-contributions', () => {
    it('should return plans the user contributes to', async () => {
      prisma.planContributor.findMany.mockResolvedValue([mockContributor]);

      const res = await request(app)
        .get('/api/contributors/my-contributions')
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.contributions).toBeDefined();
      expect(Array.isArray(res.body.contributions)).toBe(true);
      expect(res.body.contributions).toHaveLength(1);
      expect(res.body.summary).toBeDefined();
    });
  });
});
