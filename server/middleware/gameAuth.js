const jwt = require('jsonwebtoken');
const { createLogger } = require('../utils/logger');

const log = createLogger('GameAuthMW');

function gameAuth(req, res, next) {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      log.warn('missing game token', { path: req.originalUrl });
      return res.status(401).json({ message: '缺少遊戲端令牌' });
    }

    const secret = process.env.GAME_JWT_SECRET;
    if (!secret) return res.status(500).json({ message: '服務器未配置 GAME_JWT_SECRET' });

    const decoded = jwt.verify(token, secret);
    req.gameClient = decoded;
    log.step('game token verified', { sub: decoded.sub, path: req.originalUrl });
    next();
  } catch {
    log.warn('invalid game token', { path: req.originalUrl });
    return res.status(401).json({ message: '遊戲端令牌無效' });
  }
}

module.exports = { gameAuth };
