jest.mock('../src/utils/prisma', () => {
  const { mockDeep } = require('jest-mock-extended');
  return mockDeep();
});

process.env.JWT_SECRET = 'test-secret-key';
process.env.JWT_EXPIRES_IN = '1h';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const prisma = require('../src/utils/prisma');
const app = require('../src/index');

jest.mock('../src/utils/email', () => ({ sendVerificationEmail: jest.fn() }));

describe('Auth Routes', () => {
  const mockUser = {
    id: 'user-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@insurance.com',
    password: '',
    role: 'EMPLOYEE',
    departmentId: 'dept-1',
    managerId: null,
    isActive: true,
    emailVerifiedAt: new Date(),
    department: { id: 'dept-1', name: 'Underwriting' },
    manager: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    mockUser.password = await bcrypt.hash('Password123!', 12);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('should return token and user on valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.auditLog.create.mockResolvedValue({});

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'john@insurance.com', password: 'Password123!' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('john@insurance.com');
      expect(res.body.user.password).toBeUndefined();
    });

    it('should return 401 on invalid email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'wrong@insurance.com', password: 'Password123!' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    it('should return 401 on invalid password', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'john@insurance.com', password: 'WrongPassword!' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    it('should return 401 on inactive user', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, isActive: false });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'john@insurance.com', password: 'Password123!' });

      expect(res.status).toBe(401);
    });

    it('should require email verification before sign in', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, emailVerifiedAt: null });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'john@insurance.com', password: 'Password123!' });

      expect(res.status).toBe(403);
    });

    it('should return 400 on missing email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'Password123!' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should return 400 on missing password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'john@insurance.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should return 400 on invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'not-an-email', password: 'Password123!' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user with valid token', async () => {
      const token = jwt.sign({ userId: mockUser.id, role: mockUser.role }, process.env.JWT_SECRET);
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe('john@insurance.com');
      expect(res.body.password).toBeUndefined();
    });

    it('should return 401 without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/auth/change-password', () => {
    it('should change password with valid current password', async () => {
      const token = jwt.sign({ userId: mockUser.id, role: mockUser.role }, process.env.JWT_SECRET);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({});

      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'Password123!', newPassword: 'NewPass1234!' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Password changed successfully');
    });

    it('should return 400 with wrong current password', async () => {
      const token = jwt.sign({ userId: mockUser.id, role: mockUser.role }, process.env.JWT_SECRET);
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'WrongPassword!', newPassword: 'NewPass1234!' });

      expect(res.status).toBe(400);
    });

    it('should return 400 with short new password', async () => {
      const token = jwt.sign({ userId: mockUser.id, role: mockUser.role }, process.env.JWT_SECRET);
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'Password123!', newPassword: 'short' });

      expect(res.status).toBe(400);
    });
  });
});
