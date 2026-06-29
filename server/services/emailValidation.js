const { validate } = require('deep-email-validator');
const mongoose = require('mongoose');
const Registration = require('../models/Registration');
const GameSession = require('../models/GameSession');
const { createLogger } = require('../utils/logger');

const log = createLogger('EmailValidation');

const HK_TZ = 'Asia/Hong_Kong';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALIDATION_TIMEOUT_MS = Number(process.env.EMAIL_VALIDATE_TIMEOUT_MS) || 8000;
const VALIDATE_SMTP = process.env.EMAIL_VALIDATE_SMTP === 'true';

const PLAYED_STATUSES = ['registered', 'playing', 'finished', 'completed'];

function getDateKey(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: HK_TZ });
}

function getHkDayBounds(dateKey) {
  const start = new Date(`${dateKey}T00:00:00+08:00`);
  const end = new Date(`${dateKey}T23:59:59.999+08:00`);
  return { start, end };
}

function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

function isValidEmailFormat(email) {
  return EMAIL_RE.test(email);
}

async function validateEmailDeliverability(email) {
  const validationPromise = validate({
    email,
    validateRegex: true,
    validateMx: true,
    validateTypo: true,
    validateDisposable: true,
    validateSMTP: VALIDATE_SMTP,
  });

  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('timeout')), VALIDATION_TIMEOUT_MS);
  });

  try {
    const result = await Promise.race([validationPromise, timeoutPromise]);
    clearTimeout(timeoutId);

    if (result.valid) {
      log.ok('email validated', { email: maskEmail(email) });
      return { ok: true };
    }

    const failedReason = result.reason;
    log.warn('email validation failed', { email: maskEmail(email), reason: failedReason });

    if (failedReason === 'regex' || failedReason === 'typo') {
      const typoReason = result.validators?.typo?.reason;
      return {
        ok: false,
        error: 'invalid_email',
        reason: failedReason,
        suggestion: typeof typoReason === 'string' ? typoReason : undefined,
      };
    }

    return {
      ok: false,
      error: 'email_unreachable',
      reason: failedReason || 'unknown',
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.message === 'timeout') {
      log.warn('email validation timeout', { email: maskEmail(email) });
      return { ok: false, error: 'email_unreachable', reason: 'timeout' };
    }
    log.error('email validation error', err);
    return { ok: false, error: 'email_unreachable', reason: 'validation_error' };
  }
}

async function checkEmailUsedToday(email, dateKey, sessionId) {
  const sessionIdStr = String(sessionId);
  const { start, end } = getHkDayBounds(dateKey);

  const existingReg = await Registration.findOne({ email, dateKey }).lean();
  if (existingReg && existingReg.sessionId !== sessionIdStr) {
    log.step('email used today (registration)', { email: maskEmail(email), dateKey });
    return {
      usedToday: true,
      canClaimPrize: false,
      reason: 'already_registered',
    };
  }

  const otherSessionQuery = {
    email,
    status: { $in: PLAYED_STATUSES },
    emailRegisteredAt: { $gte: start, $lte: end },
  };
  if (mongoose.isValidObjectId(sessionId)) {
    otherSessionQuery._id = { $ne: sessionId };
  }

  const playedElsewhere = await GameSession.findOne(otherSessionQuery).select('_id canClaimPrize').lean();
  if (playedElsewhere) {
    log.step('email used today (session)', {
      email: maskEmail(email),
      otherSessionId: playedElsewhere._id,
    });
    return {
      usedToday: true,
      canClaimPrize: false,
      reason: 'already_registered',
    };
  }

  if (existingReg && existingReg.sessionId === sessionIdStr) {
    return {
      usedToday: true,
      canClaimPrize: existingReg.canClaimPrize !== false,
      reason: null,
    };
  }

  return { usedToday: false, canClaimPrize: true, reason: null };
}

function maskEmail(email) {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const visible = local.slice(0, 2);
  return `${visible}***@${domain}`;
}

module.exports = {
  EMAIL_RE,
  normalizeEmail,
  isValidEmailFormat,
  validateEmailDeliverability,
  checkEmailUsedToday,
  getDateKey,
};
