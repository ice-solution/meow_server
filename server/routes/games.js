const express = require('express');
const QRCode = require('qrcode');
const { body, validationResult } = require('express-validator');

const Section = require('../models/Section');
const GameSession = require('../models/GameSession');
const GameResult = require('../models/GameResult');

const { gameAuth } = require('../middleware/gameAuth');
const { signQrPayload, verifyQrPayload } = require('../utils/gameQr');
const { resolveClientUrl } = require('../utils/network');
const {
  allocateGift,
  getInventoryForToday,
  getGiftAvailability,
  getDateKey,
} = require('../services/giftInventory');
const { determineGiftTypeFromScore, getGiftScoreSettings } = require('../services/giftScoreSettings');
const { buildResultPayload } = require('../utils/result');
const { createLogger } = require('../utils/logger');

const router = express.Router();
const log = createLogger('Games');

const SESSION_TTL_MS = 30 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function randomSocketCode() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

function getClientBaseUrl(req) {
  if (req.body?.clientUrl) return String(req.body.clientUrl).replace(/\/+$/, '');
  const env = process.env.CLIENT_URL || '';
  if (env && /^https?:\/\//i.test(env) && !env.includes('localhost')) {
    return env.replace(/\/+$/, '');
  }
  return resolveClientUrl(req);
}

function getApiBaseUrl(req) {
  const host = req.get('host');
  const proto = (req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim();
  return `${proto}://${host}`;
}

function buildPrizeUrls(req, sessionId) {
  const sig = signQrPayload(sessionId);
  const clientBase = getClientBaseUrl(req);
  const apiBase = getApiBaseUrl(req);
  const resultUrl = `${clientBase}/prize/${sessionId}?sig=${sig}`;
  const resultQrImageUrl = `${apiBase}/api/games/sessions/${sessionId}/prize-qrcode.png?sig=${sig}`;
  return { resultUrl, resultQrImageUrl, sig };
}

function buildSubmitResponse(req, session) {
  const payload = buildResultPayload(session);
  if (payload.giftStatus === 'no_prize') {
    return {
      ...payload,
      resultUrl: null,
      resultQrImageUrl: null,
      sig: null,
    };
  }
  const urls = buildPrizeUrls(req, session._id);
  return {
    ...payload,
    ...urls,
  };
}

// GET /api/games/sessions/:sessionId/prize-qrcode.png
router.get('/sessions/:sessionId/prize-qrcode.png', async (req, res) => {
  const sessionId = String(req.params.sessionId);
  log.start('GET prize-qrcode.png', { sessionId });
  try {
    const { sig } = req.query;
    if (!verifyQrPayload(sessionId, sig)) {
      log.warn('prize QR invalid sig', { sessionId });
      return res.status(403).json({ message: 'QR 簽名無效' });
    }

    const session = await GameSession.findById(sessionId).select('_id status').lean();
    if (!session) return res.status(404).json({ message: 'Session 不存在' });
    if (session.status !== 'finished' && session.status !== 'completed') {
      log.warn('game not finished', { sessionId, status: session.status });
      return res.status(400).json({ message: '遊戲尚未完成' });
    }

    const resultUrl = `${getClientBaseUrl(req)}/prize/${sessionId}?sig=${sig}`;
    log.step('generating prize QR', { resultUrl });
    const png = await QRCode.toBuffer(resultUrl, { type: 'png', width: 280, margin: 1 });
    log.ok('prize QR generated', { sessionId });
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'no-store');
    res.send(png);
  } catch (error) {
    log.error('prize-qrcode error', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// GET /api/games/sessions/:sessionId/result
router.get('/sessions/:sessionId/result', async (req, res) => {
  const sessionId = String(req.params.sessionId);
  log.start('GET /result', { sessionId });
  try {
    const { sig } = req.query;
    if (!verifyQrPayload(sessionId, sig)) {
      log.warn('result invalid sig', { sessionId });
      return res.status(403).json({ message: 'QR 簽名無效' });
    }

    const session = await GameSession.findById(sessionId);
    if (!session) return res.status(404).json({ message: 'Session 不存在' });
    if (session.status !== 'finished' && session.status !== 'completed') {
      log.warn('result game not finished', { sessionId, status: session.status });
      return res.status(400).json({ message: '遊戲尚未完成' });
    }

    const data = buildSubmitResponse(req, session);
    log.ok('result returned', {
      sessionId,
      score: data.score,
      giftType: data.giftType,
      giftNumber: data.giftNumber,
    });
    res.json({ data });
  } catch (error) {
    log.error('get result error', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// GET /api/games/sessions/:sessionId/qrcode.png
router.get('/sessions/:sessionId/qrcode.png', async (req, res) => {
  const sessionId = String(req.params.sessionId);
  log.start('GET play-qrcode.png', { sessionId });
  try {
    const { sig } = req.query;
    if (!verifyQrPayload(sessionId, sig)) {
      log.warn('play QR invalid sig', { sessionId });
      return res.status(403).json({ message: 'QR 簽名無效' });
    }

    const session = await GameSession.findById(sessionId).select('_id').lean();
    if (!session) return res.status(404).json({ message: 'Session 不存在' });

    const joinUrl = `${getClientBaseUrl(req)}/play/${sessionId}?sig=${sig}`;
    log.step('generating play QR', { joinUrl });
    const png = await QRCode.toBuffer(joinUrl, { type: 'png', width: 280, margin: 1 });
    log.ok('play QR generated', { sessionId });
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'no-store');
    res.send(png);
  } catch (error) {
    log.error('play-qrcode error', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// GET /api/games/inventory/today
router.get('/inventory/today', async (_req, res) => {
  log.start('GET /inventory/today');
  try {
    const availability = await getGiftAvailability();
    log.ok('inventory', {
      dateKey: availability.dateKey,
      giftA: availability.giftA.remaining,
      giftB: availability.giftB.remaining,
      available: availability.available,
    });
    res.json({ data: availability });
  } catch (error) {
    log.error('inventory error', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// GET /api/games/gift-availability
router.get('/gift-availability', async (_req, res) => {
  log.start('GET /gift-availability');
  try {
    const data = await getGiftAvailability();
    log.ok('gift availability', { available: data.available, reason: data.reason });
    res.json({ data });
  } catch (error) {
    log.error('gift-availability error', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// GET /api/games/:sectionId/info
router.get('/:sectionId/info', gameAuth, async (req, res) => {
  log.start('GET /:sectionId/info', {
    sectionId: req.params.sectionId,
    gameClient: req.gameClient?.sub,
  });
  try {
    const section = await Section.findById(req.params.sectionId).lean();
    if (!section || section.isActive === false) {
      log.warn('section not found', { sectionId: req.params.sectionId });
      return res.status(404).json({ message: 'Section 不存在' });
    }

    const socketCode = randomSocketCode();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    const availability = await getGiftAvailability();
    const scoreSettings = await getGiftScoreSettings();

    log.step('creating session', { sectionId: section._id, socketCode });
    const session = await GameSession.create({
      gameHall: section._id,
      socketCode,
      status: 'created',
      expiresAt,
    });

    const payload = String(session._id);
    const sig = signQrPayload(payload);
    const apiBase = getApiBaseUrl(req);
    const clientBase = getClientBaseUrl(req);
    const qrCodeImageUrl = `${apiBase}/api/games/sessions/${payload}/qrcode.png?sig=${sig}`;
    const joinUrl = `${clientBase}/play/${payload}?sig=${sig}&code=${encodeURIComponent(socketCode)}`;

    log.ok('session + QR created', {
      sessionId: payload,
      joinUrl,
      hasGiftA: availability.giftA.remaining > 0,
      hasGiftB: availability.giftB.remaining > 0,
      playtimeWithinHours: availability.withinHours,
    });

    res.json({
      data: {
        section: {
          _id: section._id,
          name: section.name,
          description: section.description || '',
          seasonKey: section.seasonKey || 'season-1',
          hasGiftA: availability.giftA.remaining > 0,
          hasGiftB: availability.giftB.remaining > 0,
          playtime: {
            withinHours: availability.withinHours,
            start: availability.distributionStart,
            end: availability.distributionEnd,
            timezone: availability.timezone,
          },
          scoreThresholds: {
            minPrizeScore: scoreSettings.minPrizeScore,
            giftAMaxScore: scoreSettings.giftAMaxScore,
          },
        },
        session: {
          _id: session._id,
          socketCode,
          expiresAt,
        },
        qr: {
          payload,
          sig,
          imageUrl: qrCodeImageUrl,
          joinUrl,
        },
      },
    });
  } catch (error) {
    log.error('section info error', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// POST /api/games/sessions/:sessionId/submit-score
router.post('/sessions/:sessionId/submit-score', [
  gameAuth,
  body('score').isNumeric().withMessage('score 必須為數字'),
], async (req, res) => {
  const sessionId = String(req.params.sessionId);
  log.start('POST /submit-score', {
    sessionId,
    score: req.body?.score,
    gameClient: req.gameClient?.sub,
  });
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      log.warn('validation failed', errors.array());
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const session = await GameSession.findById(sessionId);
    if (!session) {
      log.warn('session not found', { sessionId });
      return res.status(404).json({ message: 'Session 不存在' });
    }
    if (session.expiresAt < new Date()) {
      log.warn('session expired', { sessionId });
      return res.status(400).json({ message: 'Session 已過期' });
    }

    if (session.status === 'finished' || session.status === 'completed') {
      log.step('already submitted, returning cached result', { sessionId });
      return res.json({
        message: '分數已提交',
        data: buildSubmitResponse(req, session),
      });
    }

    const score = Number(req.body.score);
    const giftType = await determineGiftTypeFromScore(score);
    log.step('score evaluated', { score, giftType, canClaimPrize: session.canClaimPrize });
    let giftNumber = null;
    let giftStatus = 'none';
    let prizeName = null;
    let prizeAsset = null;

    if (giftType && session.canClaimPrize !== false) {
      const allocation = await allocateGift(giftType);
      log.step('gift allocation', allocation);
      if (allocation.success) {
        giftNumber = allocation.giftNumber;
        prizeName = allocation.prizeName;
        prizeAsset = allocation.prizeAsset;
        giftStatus = 'awarded';
      } else {
        giftStatus = 'sold_out';
      }
    } else if (giftType && session.canClaimPrize === false) {
      giftStatus = 'email_already_claimed_today';
    } else if (!giftType) {
      giftStatus = 'no_prize';
    }

    session.score = score;
    session.giftType = giftNumber ? giftType : null;
    session.giftNumber = giftNumber;
    session.prizeName = prizeName;
    session.prizeAsset = prizeAsset;
    session.giftStatus = giftStatus;
    session.status = 'finished';
    await session.save();

    await GameResult.create({
      session: session._id,
      section: session.gameHall,
      email: session.email,
      score,
      giftType: session.giftType,
      giftNumber: session.giftNumber,
      prizeName: session.prizeName,
      prizeAsset: session.prizeAsset,
      giftStatus,
      dateKey: getDateKey(),
    });
    log.step('GameResult saved', { sessionId, giftStatus, giftNumber });

    const io = req.app.get('io');
    const resultData = buildSubmitResponse(req, session);
    if (io) {
      log.step('emit socket events', { sessionId });
      io.to(`session:${session._id}`).emit('session:updated', {
        ...resultData,
        status: session.status,
      });
      io.to(`section:${session.gameHall}`).emit('game:scoreSubmitted', resultData);
      io.to(`session:${session._id}`).emit('game:scoreSubmitted', resultData);
    }

    log.ok('score submitted', {
      sessionId,
      score,
      giftType: session.giftType,
      giftNumber: session.giftNumber,
      giftStatus,
      resultUrl: resultData.resultUrl,
    });

    res.json({
      message: '分數已提交',
      data: resultData,
    });
  } catch (error) {
    log.error('submit-score error', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

module.exports = router;
