const GiftScoreSettings = require('../models/GiftScoreSettings');
const { createLogger } = require('../utils/logger');

const log = createLogger('GiftScoreSettings');

const SETTINGS_ID = 'global';
const CACHE_MS = 5000;

const DEFAULTS = {
  minPrizeScore: 100,
  giftAMaxScore: 400,
};

let cached = null;
let cachedAt = 0;

function normalizeSettings(raw = {}) {
  return {
    minPrizeScore: Number(raw.minPrizeScore ?? DEFAULTS.minPrizeScore),
    giftAMaxScore: Number(raw.giftAMaxScore ?? DEFAULTS.giftAMaxScore),
  };
}

function validateSettings({ minPrizeScore, giftAMaxScore }) {
  const min = Number(minPrizeScore);
  const maxA = Number(giftAMaxScore);
  if (!Number.isInteger(min) || min < 0) {
    return '最低領獎分數必須為 0 或以上的整數';
  }
  if (!Number.isInteger(maxA) || maxA < min) {
    return '禮物 A 最高分必須大於或等於最低領獎分數';
  }
  return null;
}

function determineGiftType(score, settings = DEFAULTS) {
  const s = Number(score);
  const { minPrizeScore, giftAMaxScore } = normalizeSettings(settings);
  if (!Number.isFinite(s) || s < minPrizeScore) return null;
  if (s <= giftAMaxScore) return 'A';
  return 'B';
}

function formatScoreRules(settings = DEFAULTS) {
  const { minPrizeScore, giftAMaxScore } = normalizeSettings(settings);
  const noPrizeMax = Math.max(0, minPrizeScore - 1);
  return {
    noPrize: `0–${noPrizeMax}`,
    giftA: `${minPrizeScore}–${giftAMaxScore}`,
    giftB: `${giftAMaxScore + 1}+`,
  };
}

function invalidateCache() {
  cached = null;
  cachedAt = 0;
}

async function getGiftScoreSettings() {
  if (cached && Date.now() - cachedAt < CACHE_MS) {
    return { ...cached, rules: formatScoreRules(cached) };
  }

  let doc = await GiftScoreSettings.findById(SETTINGS_ID).lean();
  if (!doc) {
    doc = (await GiftScoreSettings.create({
      _id: SETTINGS_ID,
      ...DEFAULTS,
    })).toObject();
    log.step('gift score settings created with defaults', DEFAULTS);
  }

  const settings = normalizeSettings(doc);
  cached = settings;
  cachedAt = Date.now();

  return {
    ...settings,
    rules: formatScoreRules(settings),
    updatedAt: doc.updatedAt,
  };
}

async function updateGiftScoreSettings(payload) {
  const next = normalizeSettings({
    minPrizeScore: payload.minPrizeScore,
    giftAMaxScore: payload.giftAMaxScore,
  });
  const error = validateSettings(next);
  if (error) {
    const err = new Error(error);
    err.status = 400;
    throw err;
  }

  const doc = await GiftScoreSettings.findByIdAndUpdate(
    SETTINGS_ID,
    { $set: next },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  invalidateCache();
  log.ok('gift score settings updated', next);

  const settings = normalizeSettings(doc);
  return {
    ...settings,
    rules: formatScoreRules(settings),
    updatedAt: doc.updatedAt,
  };
}

async function determineGiftTypeFromScore(score) {
  const { minPrizeScore, giftAMaxScore } = await getGiftScoreSettings();
  return determineGiftType(score, { minPrizeScore, giftAMaxScore });
}

module.exports = {
  DEFAULTS,
  determineGiftType,
  determineGiftTypeFromScore,
  formatScoreRules,
  getGiftScoreSettings,
  updateGiftScoreSettings,
  validateSettings,
};
