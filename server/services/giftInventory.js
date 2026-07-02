const GiftInventory = require('../models/GiftInventory');
const Counter = require('../models/Counter');
const { createLogger } = require('../utils/logger');

const log = createLogger('GiftInventory');

const HK_TZ = 'Asia/Hong_Kong';
const PRE_REFILL_BASE = 50;
const DAILY_ALLOCATION = 100;
const DISTRIBUTION_START = { hour: 10, minute: 30 };
const DISTRIBUTION_END = { hour: 19, minute: 30 };

const PRIZE_A = { type: 'A', name: '禮物 A', asset: 'Prize2.png' };
const PRIZE_B = { type: 'B', name: '禮物 B', asset: 'Prize1.png' };

function getDateKey(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: HK_TZ });
}

function getYesterdayDateKey(date = new Date()) {
  const yesterday = new Date(date.getTime() - 24 * 60 * 60 * 1000);
  return getDateKey(yesterday);
}

function getHkParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: HK_TZ,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(date);

  const hour = Number(parts.find((p) => p.type === 'hour')?.value || 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value || 0);
  return { hour, minute, minutesSinceMidnight: hour * 60 + minute };
}

function isAfterMorningRefill(date = new Date()) {
  const { hour } = getHkParts(date);
  return hour >= 7;
}

function isWithinDistributionHours(date = new Date()) {
  const { minutesSinceMidnight } = getHkParts(date);
  const start = DISTRIBUTION_START.hour * 60 + DISTRIBUTION_START.minute;
  const end = DISTRIBUTION_END.hour * 60 + DISTRIBUTION_END.minute;
  return minutesSinceMidnight >= start && minutesSinceMidnight < end;
}

function formatTimeLabel({ hour, minute }) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function getPrizeInfo(giftType) {
  if (giftType === 'A') return PRIZE_A;
  if (giftType === 'B') return PRIZE_B;
  return null;
}

async function getYesterdayRemaining() {
  const yesterdayKey = getYesterdayDateKey();
  const yesterday = await GiftInventory.findOne({ dateKey: yesterdayKey }).lean();
  return {
    giftA: yesterday?.giftARemaining || 0,
    giftB: yesterday?.giftBRemaining || 0,
  };
}

async function ensureDailyInventory(dateKey, now = new Date()) {
  let inventory = await GiftInventory.findOne({ dateKey });
  if (!inventory) {
    const beforeRefill = !isAfterMorningRefill(now);
    inventory = await GiftInventory.create({
      dateKey,
      giftARemaining: beforeRefill ? PRE_REFILL_BASE : 0,
      giftBRemaining: beforeRefill ? PRE_REFILL_BASE : 0,
      morningRefillApplied: false,
    });
    log.step('daily inventory created', {
      dateKey,
      giftA: inventory.giftARemaining,
      giftB: inventory.giftBRemaining,
      beforeRefill,
    });
  }
  return inventory;
}

async function applyMorningRefillIfNeeded(inventory, dateKey, now = new Date()) {
  if (!isAfterMorningRefill(now) || inventory.morningRefillApplied) {
    return inventory;
  }

  const carryover = await getYesterdayRemaining();
  inventory.giftARemaining = carryover.giftA + DAILY_ALLOCATION;
  inventory.giftBRemaining = carryover.giftB + DAILY_ALLOCATION;
  inventory.morningRefillApplied = true;
  await inventory.save();

  log.ok('07:00 refill applied', {
    dateKey,
    carryoverA: carryover.giftA,
    carryoverB: carryover.giftB,
    giftA: inventory.giftARemaining,
    giftB: inventory.giftBRemaining,
  });
  return inventory;
}

async function getInventoryForToday(now = new Date()) {
  const dateKey = getDateKey(now);
  let inventory = await ensureDailyInventory(dateKey, now);
  inventory = await applyMorningRefillIfNeeded(inventory, dateKey, now);
  return inventory;
}

async function getGiftAvailability(now = new Date()) {
  const inventory = await getInventoryForToday(now);
  const withinHours = isWithinDistributionHours(now);
  const hasStock = inventory.giftARemaining > 0 || inventory.giftBRemaining > 0;
  const available = withinHours && hasStock;

  let reason = null;
  if (!withinHours) reason = 'outside_hours';
  else if (!hasStock) reason = 'sold_out';

  return {
    available,
    reason,
    withinHours,
    hasStock,
    dateKey: inventory.dateKey,
    distributionStart: formatTimeLabel(DISTRIBUTION_START),
    distributionEnd: formatTimeLabel(DISTRIBUTION_END),
    timezone: 'Asia/Hong_Kong',
    giftA: {
      remaining: inventory.giftARemaining,
      issued: inventory.giftAIssued,
    },
    giftB: {
      remaining: inventory.giftBRemaining,
      issued: inventory.giftBIssued,
    },
    morningRefillApplied: inventory.morningRefillApplied,
  };
}

async function nextGiftNumber(giftType) {
  const counterId = giftType === 'A' ? 'giftNumberA' : 'giftNumberB';
  const counter = await Counter.findByIdAndUpdate(
    counterId,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return String(counter.seq).padStart(6, '0');
}

async function allocateGift(giftType) {
  const availability = await getGiftAvailability();
  if (!availability.withinHours) {
    log.warn('gift outside distribution hours', { giftType });
    return { success: false, reason: 'outside_hours', giftType, dateKey: availability.dateKey };
  }

  const dateKey = availability.dateKey;
  const inventory = await getInventoryForToday();
  const prize = getPrizeInfo(giftType);

  const remainingField = giftType === 'A' ? 'giftARemaining' : 'giftBRemaining';
  const issuedField = giftType === 'A' ? 'giftAIssued' : 'giftBIssued';

  if (inventory[remainingField] <= 0) {
    log.warn('gift sold out', { giftType, dateKey, remaining: inventory[remainingField] });
    return { success: false, reason: 'sold_out', giftType, dateKey };
  }

  inventory[remainingField] -= 1;
  inventory[issuedField] += 1;
  await inventory.save();

  const giftNumber = await nextGiftNumber(giftType);
  log.ok('gift allocated', { giftType, giftNumber, dateKey, remaining: inventory[remainingField] });
  return {
    success: true,
    giftType,
    giftNumber,
    prizeName: prize.name,
    prizeAsset: prize.asset,
    dateKey,
  };
}

function startGiftRefillScheduler() {
  setInterval(async () => {
    try {
      const now = new Date();
      const dateKey = getDateKey(now);
      const inventory = await ensureDailyInventory(dateKey, now);
      await applyMorningRefillIfNeeded(inventory, dateKey, now);
    } catch (err) {
      console.error('[GiftInventory] scheduler error:', err.message);
    }
  }, 60 * 1000);
}

module.exports = {
  getDateKey,
  getPrizeInfo,
  getInventoryForToday,
  getGiftAvailability,
  isWithinDistributionHours,
  allocateGift,
  startGiftRefillScheduler,
  PRE_REFILL_BASE,
  DAILY_ALLOCATION,
  DISTRIBUTION_START,
  DISTRIBUTION_END,
};
