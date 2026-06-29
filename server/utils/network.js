const os = require('os');

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}

function resolveClientUrl(req) {
  if (req.body?.clientUrl) return req.body.clientUrl.replace(/\/$/, '');
  const origin = req.get('origin');
  if (origin) return origin.replace(/\/$/, '');
  const envUrl = process.env.CLIENT_URL;
  if (envUrl && !envUrl.includes('localhost')) return envUrl.replace(/\/$/, '');
  const ip = getLocalIp();
  const port = process.env.CLIENT_PORT || '5173';
  if (ip) return `http://${ip}:${port}`;
  return envUrl || 'http://localhost:5173';
}

module.exports = { getLocalIp, resolveClientUrl };
