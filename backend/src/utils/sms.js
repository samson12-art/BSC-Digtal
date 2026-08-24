const AFROMESSAGE_API = 'https://api.afromessage.com/api';

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('251') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) return `251${digits.slice(1)}`;
  if (digits.length === 9) return `251${digits}`;
  return null;
}

async function afroMessageRequest(path, params) {
  if (!process.env.AFROMESSAGE_TOKEN) {
    console.error('[SMS] AFROMESSAGE_TOKEN is not configured.');
    return null;
  }
  const query = new URLSearchParams(params);
  if (process.env.AFROMESSAGE_IDENTIFIER) query.set('from', process.env.AFROMESSAGE_IDENTIFIER);
  if (process.env.AFROMESSAGE_SENDER) query.set('sender', process.env.AFROMESSAGE_SENDER);
  try {
    const response = await fetch(`${AFROMESSAGE_API}${path}?${query}`, {
      headers: { Authorization: `Bearer ${process.env.AFROMESSAGE_TOKEN}` }
    });
    const data = await response.json();
    if (!response.ok || data.acknowledge !== 'success') {
      throw new Error(data.message || `AfroMessage returned ${response.status}`);
    }
    return data;
  } catch (error) {
    console.error('[SMS] Failed to send or verify code:', error.message);
    return null;
  }
}

function sendPhoneVerification(phone) {
  return afroMessageRequest('/challenge', {
    to: phone,
    pr: 'BSC System verification code:',
    ps: 'Do not share this code.',
    ttl: '600',
    len: '6',
    t: '0'
  });
}

function verifyPhoneCode(phone, code) {
  return afroMessageRequest('/verify', { to: phone, code: String(code) });
}

module.exports = { normalizePhone, sendPhoneVerification, verifyPhoneCode };
