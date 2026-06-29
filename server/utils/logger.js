function timestamp() {
  return new Date().toISOString();
}

function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return body;
  const copy = { ...body };
  if (copy.clientSecret) copy.clientSecret = '***';
  if (copy.password) copy.password = '***';
  return copy;
}

function log(tag, level, message, data) {
  const prefix = `[${timestamp()}] [${tag}]`;
  const line = level === 'step' ? `→ ${message}` : level === 'ok' ? `✓ ${message}` : level === 'warn' ? `⚠ ${message}` : level === 'err' ? `✗ ${message}` : message;

  if (data !== undefined) {
    const output = typeof data === 'object' ? JSON.stringify(data) : data;
    if (level === 'err') console.error(prefix, line, output);
    else if (level === 'warn') console.warn(prefix, line, output);
    else console.log(prefix, line, output);
  } else if (level === 'err') {
    console.error(prefix, line);
  } else if (level === 'warn') {
    console.warn(prefix, line);
  } else {
    console.log(prefix, line);
  }
}

function createLogger(tag) {
  return {
    start: (message, data) => log(tag, 'info', message, data),
    step: (message, data) => log(tag, 'step', message, data),
    ok: (message, data) => log(tag, 'ok', message, data),
    warn: (message, data) => log(tag, 'warn', message, data),
    error: (message, err) => log(tag, 'err', message, err?.message || err),
  };
}

module.exports = { createLogger, sanitizeBody, log };
