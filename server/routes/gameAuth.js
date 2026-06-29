const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { adminKeyAuth } = require('../middleware/adminKeyAuth');
const GameClient = require('../models/GameClient');
const { createLogger } = require('../utils/logger');

const router = express.Router();
const log = createLogger('GameAuth');

function generateSecret() {
  return crypto.randomBytes(24).toString('base64url');
}

function issueGameJwt({ clientId, expiresInDays }) {
  const secret = process.env.GAME_JWT_SECRET;
  if (!secret) throw new Error('Missing GAME_JWT_SECRET');

  const days = expiresInDays ? Number(expiresInDays) : 30;
  const expiresInSec = Math.max(60, Math.min(365 * 24 * 3600, Math.floor(days * 24 * 3600)));
  const expiresAt = new Date(Date.now() + expiresInSec * 1000);

  const token = jwt.sign(
    { iss: 'weow', aud: 'game-client', sub: String(clientId || 'game-client') },
    secret,
    { expiresIn: expiresInSec }
  );

  return { token, expiresAt };
}

router.post('/login', [
  body('clientId').isString().isLength({ min: 1, max: 64 }).withMessage('clientId 必須為 1-64 字'),
  body('clientSecret').isString().isLength({ min: 1, max: 256 }).withMessage('clientSecret 必須為字串'),
  body('expiresInDays').optional().isInt({ min: 1, max: 365 }),
], async (req, res) => {
  log.start('POST /login', { clientId: req.body.clientId });
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

    const client = await GameClient.findOne({ clientId: req.body.clientId }).select('+secretHash');
    if (!client || !client.isActive) {
      log.warn('login failed', { clientId: req.body.clientId });
      return res.status(401).json({ message: 'Game client 認證失敗' });
    }

    const ok = await bcrypt.compare(String(req.body.clientSecret), String(client.secretHash));
    if (!ok) {
      log.warn('login secret mismatch', { clientId: req.body.clientId });
      return res.status(401).json({ message: 'Game client 認證失敗' });
    }

    client.lastLoginAt = new Date();
    await client.save();

    const { token, expiresAt } = issueGameJwt({
      clientId: client.clientId,
      expiresInDays: req.body.expiresInDays,
    });

    log.ok('login success', { clientId: client.clientId, expiresAt });
    res.json({ data: { token, expiresAt } });
  } catch (error) {
    log.error('login error', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

router.post('/token', [
  adminKeyAuth,
  body('clientId').optional().isString().isLength({ min: 1, max: 64 }),
  body('expiresInDays').optional().isInt({ min: 1, max: 365 }),
], async (req, res) => {
  log.start('POST /token (admin)', { clientId: req.body.clientId });
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

    const { token, expiresAt } = issueGameJwt({
      clientId: req.body.clientId,
      expiresInDays: req.body.expiresInDays,
    });
    log.ok('token issued', { clientId: req.body.clientId || 'game-client' });
    res.json({ data: { token, expiresAt } });
  } catch (error) {
    log.error('token error', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

module.exports = { router, generateSecret };
