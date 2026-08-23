const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const prisma = require('./utils/prisma');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const departmentRoutes = require('./routes/departments');
const planRoutes = require('./routes/plans');
const approvalRoutes = require('./routes/approvals');
const dashboardRoutes = require('./routes/dashboard');
const reportRoutes = require('./routes/reports');
const notificationRoutes = require('./routes/notifications');
const auditRoutes = require('./routes/audit');
const contributorRoutes = require('./routes/contributors');

const app = express();
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const corsOptions = {
  origin(origin, callback) {
    // Requests without an Origin header include Render health checks and curl.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true
};

app.use(helmet());
app.use(cors(corsOptions));
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/contributors', contributorRoutes);
app.get('/', (req, res) => res.status(200).json({
  message: 'BSC Management API is running',
  health: '/api/health'
}));
app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true }
});

app.set('io', io);

async function ensureInitialCeo() {
  const email = process.env.INITIAL_CEO_EMAIL?.trim().toLowerCase().replace(/\\/g, '');
  const password = process.env.INITIAL_CEO_PASSWORD;
  if (!email || !password) return;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (process.env.RESET_INITIAL_CEO_PASSWORD === 'true') {
      await prisma.user.update({ where: { id: existing.id }, data: { password: await bcrypt.hash(password, 12) } });
      console.log(`Initial CEO password reset for ${email}`);
    }
    return;
  }

  const [department, boardMember] = await Promise.all([
    prisma.department.findUnique({ where: { name: 'Executive Office' } }),
    prisma.user.findFirst({ where: { role: 'BOARD_MEMBER', isActive: true }, select: { id: true } })
  ]);
  await prisma.user.create({
    data: {
      firstName: 'Samson', lastName: 'Yeshanew', email,
      password: await bcrypt.hash(password, 12), role: 'CEO',
      departmentId: department?.id, managerId: boardMember?.id
    }
  });
  console.log(`Initial CEO account created for ${email}`);
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('join', (userId) => {
    socket.join(`user_${userId}`);
  });
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  ensureInitialCeo()
    .catch(error => console.error('Initial CEO setup failed:', error.message))
    .finally(() => httpServer.listen(PORT, () => console.log(`BSC Server running on port ${PORT}`)));
}
