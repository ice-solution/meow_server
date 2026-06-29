const crypto = require('crypto');

function requireQrSecret() {
  const secret = process.env.GAME_QR_SECRET;
  if (!secret) throw new Error('Missing GAME_QR_SECRET');
  return secret;
}

function signQrPayload(payload) {
  const secret = requireQrSecret();
  return crypto.createHmac('sha256', secret).update(String(payload)).digest('hex');
}

function verifyQrPayload(payload, sig) {
  if (!payload || !sig) return false;
  try {
    const expected = signQrPayload(payload);
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(String(sig), 'hex'));
  } catch {
    return false;
  }
}

module.exports = { signQrPayload, verifyQrPayload };
