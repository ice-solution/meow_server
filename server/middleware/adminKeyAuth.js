/**
 * Admin 驗證
 * Header: X-Admin-Key 或 Authorization: Bearer <ADMIN_API_KEY>
 */
const { createLogger } = require('../utils/logger');
const log = createLogger('AdminAuth');

function adminKeyAuth(req, res, next) {
  const configured = process.env.ADMIN_API_KEY;
  if (!configured) {
    return res.status(500).json({ message: '服務器未配置 ADMIN_API_KEY' });
  }

  const headerKey = req.header('X-Admin-Key');
  const bearer = req.header('Authorization')?.replace(/^Bearer\s+/i, '');
  const key = headerKey || bearer;

  if (!key || key !== configured) {
    log.warn('admin auth failed', { path: req.originalUrl });
    return res.status(401).json({ message: 'Admin 驗證失敗' });
  }

  log.step('admin auth ok', { path: req.originalUrl });
  next();
}

module.exports = { adminKeyAuth };
