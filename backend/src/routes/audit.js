const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, authorize('CEO', 'EXECUTIVE_MANAGER', 'BOARD_MEMBER'), async (req, res) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
