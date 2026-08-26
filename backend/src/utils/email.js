const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = port === 465;
  if (host) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    transporter = nodemailer.createTransport({ jsonTransport: true });
  }
  return transporter;
}

function buildNotificationEmail(title, message, type, linkUrl) {
  const iconMap = {
    APPROVAL: { color: '#16a34a', emoji: '✅' },
    REJECTION: { color: '#dc2626', emoji: '❌' },
    REVISION: { color: '#f59e0b', emoji: '🔄' },
    REVIEW_REQUIRED: { color: '#3b82f6', emoji: '📋' },
    COMMENT: { color: '#8b5cf6', emoji: '💬' },
  };
  const { color, emoji } = iconMap[type] || { color: '#6b7280', emoji: '📌' };

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f6f8f7;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
  <div style="background:#136f63;padding:24px 32px;">
    <h1 style="color:#ffffff;font-size:18px;margin:0;">BSC Management System</h1>
  </div>
  <div style="padding:32px;">
    <div style="text-align:center;margin-bottom:24px;">
      <span style="font-size:48px;">${emoji}</span>
    </div>
    <h2 style="color:#17211f;font-size:20px;text-align:center;margin:0 0 8px;">${title}</h2>
    <p style="color:#6c7774;font-size:14px;text-align:center;margin:0 0 24px;">${message}</p>
    ${linkUrl ? `<div style="text-align:center;margin-bottom:24px;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}${linkUrl}"
         style="display:inline-block;background:#136f63;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">
         View Details
      </a>
    </div>` : ''}
    <hr style="border:none;border-top:1px solid #dfe7e4;margin:24px 0;">
    <p style="color:#6c7774;font-size:12px;text-align:center;margin:0;">
      This is an automated notification from the BSC Management System.<br>
      Do not reply to this email.
    </p>
  </div>
</div>
</body>
</html>`;

  const text = `${title}\n\n${message}${linkUrl ? `\n\nView details: ${process.env.FRONTEND_URL || 'http://localhost:5173'}${linkUrl}` : ''}`;

  return { html, text };
}

async function sendEmail(to, subject, html, text) {
  try {
    if (process.env.RESEND_API_KEY) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || 'BSC System <onboarding@resend.dev>',
          to: [to],
          subject,
          html,
          text
        })
      });
      if (!response.ok) {
        throw new Error(`Resend API returned ${response.status}: ${await response.text()}`);
      }
      return response.json();
    }

    if (!process.env.SMTP_HOST) {
      console.warn('[EMAIL] No email provider configured. Set RESEND_API_KEY or SMTP_HOST.');
      return null;
    }

    const transport = getTransporter();
    const info = await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'BSC System <noreply@bsc-system.com>',
      to,
      subject,
      html,
      text,
    });
    return info;
  } catch (error) {
    console.error('[EMAIL] Failed to send:', error.message);
    return null;
  }
}

async function sendNotificationEmail(userEmail, title, message, type, linkUrl = null) {
  const { html, text } = buildNotificationEmail(title, message, type, linkUrl);
  const subject = `BSC System: ${title}`;
  return sendEmail(userEmail, subject, html, text);
}

async function sendVerificationEmail(userEmail, firstName, token) {
  const apiUrl = process.env.API_URL || 'http://localhost:5000';
  const verificationUrl = `${apiUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  const subject = 'BSC System: Verify your email address';
  const text = `Hello ${firstName},\n\nVerify your email address to activate your BSC System account:\n${verificationUrl}\n\nThis link expires in 24 hours.`;
  const html = `<p>Hello ${firstName},</p><p>Verify your email address to activate your BSC System account.</p><p><a href="${verificationUrl}">Verify email address</a></p><p>This link expires in 24 hours.</p>`;
  return sendEmail(userEmail, subject, html, text);
}

async function sendPasswordResetEmail(userEmail, firstName, token) {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?resetToken=${encodeURIComponent(token)}`;
  const subject = 'BSC System: Reset your password';
  const text = `Hello ${firstName},\n\nUse this link to reset your BSC System password:\n${resetUrl}\n\nThis link expires in 30 minutes. If you did not request a reset, you can safely ignore this email.`;
  const html = `<p>Hello ${firstName},</p><p>Use the link below to reset your BSC System password.</p><p><a href="${resetUrl}">Reset password</a></p><p>This link expires in 30 minutes. If you did not request it, you can safely ignore this email.</p>`;
  return sendEmail(userEmail, subject, html, text);
}

module.exports = { sendEmail, sendNotificationEmail, sendVerificationEmail, sendPasswordResetEmail, getTransporter };
