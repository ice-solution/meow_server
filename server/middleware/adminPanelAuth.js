const jwt = require('jsonwebtoken');
const { createLogger } = require('../utils/logger');

const log = createLogger('AdminPanelAuth');

function getJwtSecret() {
  return process.env.ADMIN_PANEL_JWT_SECRET || process.env.ADMIN_API_KEY;
}

function adminPanelAuth(req, res, next) {
  const secret = getJwtSecret();
  if (!secret) {
    return res.status(500).json({ message: '服務器未配置 ADMIN_PANEL_JWT_SECRET' });
  }

  const bearer = req.header('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!bearer) {
    return res.status(401).json({ message: '未登入' });
  }

  try {
    const payload = jwt.verify(bearer, secret);
    if (payload.role !== 'admin_panel') {
      return res.status(401).json({ message: '無效 token' });
    }
    req.adminUser = payload.sub;
    next();
  } catch (err) {
    log.warn('admin panel auth failed', { error: err.message });
    return res.status(401).json({ message: '登入已過期，請重新登入' });
  }
}

module.exports = { adminPanelAuth, getJwtSecret };
