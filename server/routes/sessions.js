const express = require('express');
const mongoose = require('mongoose');
const GameSession = require('../models/GameSession');
const Registration = require('../models/Registration');
const { verifyQrPayload } = require('../utils/gameQr');
const { getGiftAvailability } = require('../services/giftInventory');
const {
  normalizeEmail,
  isValidEmailFormat,
  validateEmailDeliverability,
  checkEmailUsedToday,
  getDateKey,
} = require('../services/emailValidation');
const { createLogger } = require('../utils/logger');

const router = express.Router();
const log = createLogger('Sessions');

async function findSession(sessionId, req) {
  log.step('findSession', { sessionId });

  if (!mongoose.isValidObjectId(sessionId)) {
    log.warn('invalid sessionId format', { sessionId });
    return null;
  }

  const session = await GameSession.findById(sessionId);
  if (!session || session.expiresAt < new Date()) {
    log.warn('session not found or expired', { sessionId });
    return null;
  }

  const sig = req.query.sig || req.body?.sig;
  const code = req.query.code || req.body?.code;
  if (sig && !verifyQrPayload(sessionId, sig)) {
    log.warn('invalid sig', { sessionId });
    return null;
  }
  if (code && String(session.socketCode) !== String(code)) {
    log.warn('socket code mismatch', { sessionId, code });
    return null;
  }

  log.step('session found', { sessionId, status: session.status });
  return session;
}

router.get('/:sessionId', async (req, res) => {
  log.start('GET /:sessionId', { sessionId: req.params.sessionId });
  try {
    const session = await findSession(req.params.sessionId, req);
    if (!session) {
      log.warn('GET session failed', { sessionId: req.params.sessionId });
      return res.status(404).json({ error: 'Session not found' });
    }

    log.ok('GET session', { sessionId: session._id, status: session.status });
    res.json({
      sessionId: String(session._id),
      status: session.status,
      termsAcceptedAt: session.termsAcceptedAt,
      email: session.email,
      canClaimPrize: session.canClaimPrize,
      emailSkipped: !!session.emailSkipped,
      playFlow: session.playFlow || null,
      score: session.score,
      giftType: session.giftType,
      giftNumber: session.giftNumber,
      expiresAt: session.expiresAt,
    });
  } catch (err) {
    log.error('GET session error', err);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

router.post('/:sessionId/accept-terms', async (req, res) => {
  log.start('POST /:sessionId/accept-terms', { sessionId: req.params.sessionId });
  try {
    const session = await findSession(req.params.sessionId, req);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    session.status = 'terms_accepted';
    session.termsAcceptedAt = new Date();
    const flow = req.body?.flow || req.query?.flow;
    if (flow === 'sold-out') {
      session.playFlow = 'sold-out';
      session.giftsUnavailable = true;
    }
    await session.save();

    log.step('emit session:updated', { sessionId: session._id, status: session.status });
    const io = req.app.get('io');
    io.to(`session:${session._id}`).emit('session:updated', {
      sessionId: String(session._id),
      status: session.status,
      termsAcceptedAt: session.termsAcceptedAt,
    });

    log.ok('terms accepted', { sessionId: session._id });
    res.json({
      sessionId: String(session._id),
      status: session.status,
      termsAcceptedAt: session.termsAcceptedAt,
    });
  } catch (err) {
    log.error('accept-terms error', err);
    res.status(500).json({ error: 'Failed to accept terms' });
  }
});

router.post('/:sessionId/proceed-sold-out', async (req, res) => {
  log.start('POST /:sessionId/proceed-sold-out', { sessionId: req.params.sessionId });
  try {
    const session = await findSession(req.params.sessionId, req);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const availability = await getGiftAvailability();
    if (availability.available) {
      log.warn('gifts still available, use terms flow', { sessionId: session._id });
      return res.status(400).json({ error: 'gifts_available' });
    }

    if (session.status === 'created' || session.status === 'connected') {
      session.status = 'terms_accepted';
      session.termsAcceptedAt = new Date();
      session.giftsUnavailable = true;
      await session.save();
    }

    const io = req.app.get('io');
    io.to(`session:${session._id}`).emit('session:updated', {
      sessionId: String(session._id),
      status: session.status,
      giftsUnavailable: true,
    });

    log.ok('proceed sold out', { sessionId: session._id, status: session.status });
    res.json({
      sessionId: String(session._id),
      status: session.status,
      giftsUnavailable: true,
    });
  } catch (err) {
    log.error('proceed-sold-out error', err);
    res.status(500).json({ error: 'Failed to proceed' });
  }
});

router.post('/:sessionId/skip-email', async (req, res) => {
  log.start('POST /:sessionId/skip-email', { sessionId: req.params.sessionId });
  try {
    const session = await findSession(req.params.sessionId, req);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'terms_accepted' && session.status !== 'registered') {
      log.warn('terms not accepted for skip-email', { sessionId: session._id, status: session.status });
      return res.status(400).json({ error: 'terms_not_accepted' });
    }

    const availability = await getGiftAvailability();
    if (availability.withinHours) {
      log.warn('skip-email only for outside hours', { sessionId: session._id });
      return res.status(400).json({ error: 'email_required' });
    }

    session.emailSkipped = true;
    session.playFlow = 'outside-hours';
    session.canClaimPrize = false;
    session.status = 'registered';
    session.emailRegisteredAt = new Date();
    await session.save();

    const payload = {
      sessionId: String(session._id),
      status: session.status,
      emailSkipped: true,
      playFlow: session.playFlow,
      canClaimPrize: false,
    };

    const io = req.app.get('io');
    io.to(`session:${session._id}`).emit('session:updated', payload);

    log.ok('skip-email', { sessionId: session._id });
    res.json(payload);
  } catch (err) {
    log.error('skip-email error', err);
    res.status(500).json({ error: 'Failed to skip email' });
  }
});

router.post('/:sessionId/start-game', async (req, res) => {
  log.start('POST /:sessionId/start-game', { sessionId: req.params.sessionId });
  try {
    const session = await findSession(req.params.sessionId, req);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'registered' && session.status !== 'playing') {
      log.warn('cannot start game', { sessionId: session._id, status: session.status });
      return res.status(400).json({ error: 'not_registered' });
    }

    session.status = 'playing';
    session.gameStartedAt = new Date();
    await session.save();

    const payload = {
      sessionId: String(session._id),
      status: session.status,
      email: session.email,
      socketCode: session.socketCode,
      gameStartedAt: session.gameStartedAt,
    };

    const io = req.app.get('io');
    io.to(`session:${session._id}`).emit('session:updated', payload);
    io.to(`session:${session._id}`).emit('session:game-start', payload);
    if (session.gameHall) {
      io.to(`section:${session.gameHall}`).emit('session:game-start', payload);
    }

    log.ok('game started', { sessionId: session._id });
    res.json(payload);
  } catch (err) {
    log.error('start-game error', err);
    res.status(500).json({ error: 'Failed to start game' });
  }
});

router.post('/:sessionId/register-email', async (req, res) => {
  log.start('POST /:sessionId/register-email', {
    sessionId: req.params.sessionId,
    email: req.body?.email,
  });
  try {
    const session = await findSession(req.params.sessionId, req);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (session.status !== 'terms_accepted' && session.status !== 'registered') {
      log.warn('terms not accepted yet', { sessionId: session._id, status: session.status });
      return res.status(400).json({ error: 'Terms not accepted yet' });
    }

    const normalizedEmail = normalizeEmail(req.body.email);
    if (!isValidEmailFormat(normalizedEmail)) {
      log.warn('invalid email format', { email: normalizedEmail });
      return res.status(400).json({ error: 'invalid_email' });
    }

    const deliverability = await validateEmailDeliverability(normalizedEmail);
    if (!deliverability.ok) {
      log.warn('email deliverability failed', {
        email: normalizedEmail,
        error: deliverability.error,
        reason: deliverability.reason,
      });
      return res.status(400).json({
        error: deliverability.error,
        reason: deliverability.reason,
        suggestion: deliverability.suggestion,
      });
    }

    const dateKey = getDateKey();
    const usage = await checkEmailUsedToday(normalizedEmail, dateKey, session._id);

    const canClaimPrize = usage.reason === 'already_registered' ? false : usage.canClaimPrize !== false;
    const isResubmitSameSession = usage.usedToday && !usage.reason;
    const alreadyUsedToday = usage.usedToday && usage.reason === 'already_registered';
    const acceptDuplicate = req.body.acceptDuplicate === true;

    log.step('email check', {
      email: normalizedEmail,
      canClaimPrize,
      isResubmitSameSession,
      alreadyUsedToday,
      acceptDuplicate,
    });

    if (alreadyUsedToday && !acceptDuplicate) {
      log.ok('email duplicate today, awaiting confirm', {
        sessionId: session._id,
        email: normalizedEmail,
      });
      return res.json({
        warning: 'already_registered',
        canClaimPrize: false,
        persisted: false,
      });
    }

    if (!isResubmitSameSession) {
      await Registration.create({
        email: normalizedEmail,
        sessionId: String(session._id),
        dateKey,
        canClaimPrize,
      });
      log.step('registration created', { email: normalizedEmail, dateKey });
    }

    session.email = normalizedEmail;
    session.emailRegisteredAt = new Date();
    session.canClaimPrize = canClaimPrize;
    session.status = 'registered';
    await session.save();

    const io = req.app.get('io');
    io.to(`session:${session._id}`).emit('session:updated', {
      sessionId: String(session._id),
      status: session.status,
      email: session.email,
      canClaimPrize: session.canClaimPrize,
    });

    log.ok('email registered', {
      sessionId: session._id,
      email: normalizedEmail,
      canClaimPrize,
    });

    res.json({
      sessionId: String(session._id),
      status: session.status,
      email: session.email,
      canClaimPrize,
      persisted: true,
    });
  } catch (err) {
    log.error('register-email error', err);
    res.status(500).json({ error: 'Failed to register email' });
  }
});

module.exports = router;
