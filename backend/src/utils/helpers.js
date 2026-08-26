const prisma = require('./prisma');
const { sendNotificationEmail } = require('./email');
const { sendSMS, normalizePhone } = require('./sms');

async function createNotification(userId, title, message, type, linkUrl = null) {
  const notification = await prisma.notification.create({
    data: { userId, title, message, type, linkUrl }
  });

  if (process.env.RESEND_API_KEY || process.env.SMTP_HOST || process.env.AFROMESSAGE_TOKEN) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, phone: true } });

      if (process.env.SMTP_HOST && user && user.email) {
        sendNotificationEmail(user.email, title, message, type, linkUrl);
      }

      if (process.env.AFROMESSAGE_TOKEN && user && user.phone) {
        const phone = normalizePhone(user.phone);
        if (phone) {
          const smsText = `${title}\n${message}`.slice(0, 480);
          const result = await sendSMS(phone, smsText);
          if (!result) console.error('[SMS] Notification SMS not delivered.');
        } else {
          console.error('[SMS] Invalid phone format for user:', user.email);
        }
      }
    } catch (err) {
      console.error('[NOTIFY] Failed to deliver notification:', err.message);
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
    'EMPLOYEE': 'DIVISION_MANAGER',
    'DIVISION_MANAGER': 'DEPARTMENT_MANAGER',
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
    'DIVISION_MANAGER': 'Division Manager',
    'EMPLOYEE': 'Employee'
  };
  return labels[role] || role;
}

function calculateAchievementPercentage(actual, target) {
  if (!target || target === 0) return 0;
  return Math.min(Math.round((actual / target) * 100), 150);
}

module.exports = { createNotification, createAuditLog, getNextReviewerRole, getRoleLabel, calculateAchievementPercentage };
