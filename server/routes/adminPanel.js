const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { adminPanelAuth, getJwtSecret } = require('../middleware/adminPanelAuth');
const {
  getOverview,
  getEmailList,
  getCounters,
  updateCounters,
  getDailyHistory,
  getDateKey,
} = require('../services/adminStats');
const {
  getGiftScoreSettings,
  updateGiftScoreSettings,
} = require('../services/giftScoreSettings');
const { sendClientEmailReport } = require('../services/clientEmailReport');
const { clearAllGameData } = require('../services/dataReset');
const { createLogger } = require('../utils/logger');

const router = express.Router();
const log = createLogger('AdminPanel');

const TOKEN_TTL_SEC = 12 * 60 * 60;

function getCredentials() {
  return {
    username: process.env.ADMIN_PANEL_USERNAME || '',
    password: process.env.ADMIN_PANEL_PASSWORD || '',
  };
}

router.post('/login', [
  body('username').isString().trim().notEmpty(),
  body('password').isString().notEmpty(),
], async (req, res) => {
  log.start('POST /login');
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: '請輸入帳號及密碼' });
    }

    const { username, password } = getCredentials();
    if (!username || !password) {
      log.error('ADMIN_PANEL_USERNAME/PASSWORD not configured');
      return res.status(500).json({ message: '服務器未配置管理員帳號' });
    }

    const secret = getJwtSecret();
    if (!secret) {
      return res.status(500).json({ message: '服務器未配置 ADMIN_PANEL_JWT_SECRET' });
    }

    const { username: inputUser, password: inputPass } = req.body;
    if (inputUser !== username || inputPass !== password) {
      log.warn('login failed', { username: inputUser });
      return res.status(401).json({ message: '帳號或密碼錯誤' });
    }

    const expiresAt = new Date(Date.now() + TOKEN_TTL_SEC * 1000);
    const token = jwt.sign({ role: 'admin_panel', sub: username }, secret, {
      expiresIn: TOKEN_TTL_SEC,
    });

    log.ok('login success', { username });
    res.json({ token, expiresAt: expiresAt.toISOString(), username });
  } catch (err) {
    log.error('login error', err);
    res.status(500).json({ message: '登入失敗' });
  }
});

router.get('/me', adminPanelAuth, (req, res) => {
  res.json({ username: req.adminUser });
});

router.get('/overview', adminPanelAuth, async (req, res) => {
  try {
    const dateKey = req.query.dateKey || getDateKey();
    const data = await getOverview(dateKey);
    res.json({ data });
  } catch (err) {
    log.error('overview error', err);
    res.status(500).json({ message: '無法載入總覽' });
  }
});

router.get('/emails', adminPanelAuth, async (req, res) => {
  try {
    const data = await getEmailList({
      dateKey: req.query.dateKey || undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 50,
    });
    res.json({ data });
  } catch (err) {
    log.error('emails error', err);
    res.status(500).json({ message: '無法載入用戶列表' });
  }
});

router.get('/daily-history', adminPanelAuth, async (req, res) => {
  try {
    const days = Number(req.query.days) || 7;
    const data = await getDailyHistory(days);
    res.json({ data });
  } catch (err) {
    log.error('daily-history error', err);
    res.status(500).json({ message: '無法載入每日統計' });
  }
});

router.get('/counters', adminPanelAuth, async (_req, res) => {
  try {
    const data = await getCounters();
    res.json({ data });
  } catch (err) {
    log.error('counters get error', err);
    res.status(500).json({ message: '無法載入序號' });
  }
});

router.put('/counters', adminPanelAuth, [
  body('giftNumberA').optional().isInt({ min: 0 }),
  body('giftNumberB').optional().isInt({ min: 0 }),
], async (req, res) => {
  log.start('PUT /counters');
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    if (req.body.giftNumberA === undefined && req.body.giftNumberB === undefined) {
      return res.status(400).json({ message: '請提供 giftNumberA 或 giftNumberB' });
    }

    const data = await updateCounters({
      giftNumberA: req.body.giftNumberA,
      giftNumberB: req.body.giftNumberB,
    });
    log.ok('counters updated', data);
    res.json({ data });
  } catch (err) {
    log.error('counters put error', err);
    res.status(500).json({ message: '無法更新序號' });
  }
});

router.get('/gift-score-settings', adminPanelAuth, async (_req, res) => {
  try {
    const data = await getGiftScoreSettings();
    res.json({ data });
  } catch (err) {
    log.error('gift-score-settings get error', err);
    res.status(500).json({ message: '無法載入分數設定' });
  }
});

router.put('/gift-score-settings', adminPanelAuth, [
  body('minPrizeScore').isInt({ min: 0 }).withMessage('最低領獎分數必須為 0 或以上的整數'),
  body('giftAMaxScore').isInt({ min: 0 }).withMessage('禮物 A 最高分必須為 0 或以上的整數'),
], async (req, res) => {
  log.start('PUT /gift-score-settings', req.body);
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const data = await updateGiftScoreSettings({
      minPrizeScore: req.body.minPrizeScore,
      giftAMaxScore: req.body.giftAMaxScore,
    });
    log.ok('gift score settings updated', data);
    res.json({ data });
  } catch (err) {
    log.error('gift-score-settings put error', err);
    res.status(err.status || 500).json({ message: err.message || '無法更新分數設定' });
  }
});

router.post('/send-client-email', adminPanelAuth, async (_req, res) => {
  log.start('POST /send-client-email');
  try {
    const data = await sendClientEmailReport({ trigger: 'manual' });
    log.ok('manual client email sent', data);
    res.json({ data, message: `已發送 ${data.rowCount} 筆 Email 列表至客戶` });
  } catch (err) {
    log.error('send-client-email error', err);
    res.status(500).json({ message: err.message || '無法發送電郵' });
  }
});

router.post('/clear-data', adminPanelAuth, [
  body('confirmStep1').equals('true').withMessage('需要完成第一次確認'),
  body('confirmStep2').equals('true').withMessage('需要完成第二次確認'),
  body('confirmPhrase').equals('清除所有資料').withMessage('確認文字不正確'),
], async (req, res) => {
  log.start('POST /clear-data');
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const data = await clearAllGameData();
    log.ok('clear-data completed', data);
    res.json({
      data,
      message: '已清除所有遊戲資料（禮物分數門檻已保留，序號已重設為 0）',
    });
  } catch (err) {
    log.error('clear-data error', err);
    res.status(500).json({ message: err.message || '無法清除資料' });
  }
});

module.exports = router;
