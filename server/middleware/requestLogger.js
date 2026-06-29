const { createLogger, sanitizeBody } = require('../utils/logger');

function requestLogger(req, res, next) {
  if (!req.originalUrl.startsWith('/api')) return next();

  const start = Date.now();
  const reqId = Math.random().toString(36).slice(2, 8).toUpperCase();
  req.reqId = reqId;

  const tag = `HTTP:${reqId}`;
  const log = createLogger(tag);

  log.start(`${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    ...(req.method !== 'GET' && Object.keys(req.body || {}).length
      ? { body: sanitizeBody(req.body) }
      : {}),
    ...(Object.keys(req.query || {}).length ? { query: req.query } : {}),
  });

  res.on('finish', () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'ok';
    log[level](`${res.statusCode} ${req.method} ${req.originalUrl} (${ms}ms)`);
  });

  next();
}

module.exports = { requestLogger };
