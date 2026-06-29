const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { adminKeyAuth } = require('../middleware/adminKeyAuth');
const GameClient = require('../models/GameClient');
const { generateSecret } = require('./gameAuth');
const { createLogger } = require('../utils/logger');

const router = express.Router();
const log = createLogger('GameClients');

router.get('/', adminKeyAuth, async (_req, res) => {
  log.start('GET /game-clients');
  try {
    const items = await GameClient.find().sort({ createdAt: -1 }).lean();
    log.ok('list game clients', { count: items.length });
    res.json({ data: { items } });
  } catch (error) {
    log.error('list game clients error', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

router.post('/', [
  adminKeyAuth,
  body('clientId').trim().isLength({ min: 3, max: 64 }).withMessage('clientId 必須為 3-64 字'),
  body('name').optional().isString().isLength({ max: 80 }),
  body('isActive').optional().isBoolean(),
], async (req, res) => {
  log.start('POST /game-clients', { clientId: req.body.clientId });
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

    const secret = generateSecret();
    const secretHash = await bcrypt.hash(secret, 12);

    const item = await GameClient.create({
      clientId: req.body.clientId,
      name: req.body.name || '',
      isActive: req.body.isActive !== undefined ? !!req.body.isActive : true,
      secretHash,
    });

    log.ok('game client created', { clientId: item.clientId, id: item._id });
    res.status(201).json({
      message: 'Game client 已建立',
      data: {
        item: {
          _id: item._id,
          clientId: item.clientId,
          name: item.name,
          isActive: item.isActive,
          createdAt: item.createdAt,
        },
        clientSecret: secret,
      },
    });
  } catch (error) {
    if (error?.code === 11000) return res.status(400).json({ message: 'clientId 已存在' });
    log.error('create game client error', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

router.delete('/:id', adminKeyAuth, async (req, res) => {
  log.start('DELETE /game-clients/:id', { id: req.params.id });
  try {
    const item = await GameClient.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: 'Game client 不存在' });
    log.ok('game client deleted', { id: req.params.id, clientId: item.clientId });
    res.json({ message: '已刪除' });
  } catch (error) {
    log.error('delete game client error', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

module.exports = router;
