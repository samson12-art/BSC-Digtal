const prisma = require('./prisma');
const { sendNotificationEmail } = require('./email');

async function createNotification(userId, title, message, type, linkUrl = null) {
  const notification = await prisma.notification.create({
    data: { userId, title, message, type, linkUrl }
  });

  if (process.env.SMTP_HOST) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, firstName: true, lastName: true } });
      if (user && user.email) {
        sendNotificationEmail(user.email, title, message, type, linkUrl);
      }
    } catch (err) {
      console.error('[EMAIL] Failed to send notification email:', err.message);
    }
  }

  return notification;
}

async function createAuditLog(userId, userName, action, entity, entityId, details = null, ipAddress = null) {
  return prisma.auditLog.create({
    data: { userId, userName, action, entity, entityId, details, ipAddress }
  });
}

function getNextReviewerRole(currentRole) {
  const hierarchy = {
    'EMPLOYEE': 'TEAM_LEADER',
    'TEAM_LEADER': 'DEPARTMENT_MANAGER',
    'DEPARTMENT_MANAGER': 'EXECUTIVE_MANAGER',
    'EXECUTIVE_MANAGER': 'CEO',
    'CEO': 'BOARD_MEMBER'
  };
  return hierarchy[currentRole];
}

function getRoleLabel(role) {
  const labels = {
    'BOARD_MEMBER': 'Board of Directors',
    'CEO': 'Chief Executive Officer',
    'EXECUTIVE_MANAGER': 'Executive Manager',
    'DEPARTMENT_MANAGER': 'Department Manager',
    'TEAM_LEADER': 'Team Leader',
    'EMPLOYEE': 'Employee'
  };
  return labels[role] || role;
}

function calculateAchievementPercentage(actual, target) {
  if (!target || target === 0) return 0;
  return Math.min(Math.round((actual / target) * 100), 150);
}

module.exports = { createNotification, createAuditLog, getNextReviewerRole, getRoleLabel, calculateAchievementPercentage };
