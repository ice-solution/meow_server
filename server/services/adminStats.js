const Registration = require('../models/Registration');
const GameResult = require('../models/GameResult');
const GiftInventory = require('../models/GiftInventory');
const Counter = require('../models/Counter');
const mongoose = require('mongoose');
const { getGiftAvailability, getDateKey } = require('./giftInventory');
const { getGiftScoreSettings } = require('./giftScoreSettings');

async function getCounters() {
  const [counterA, counterB] = await Promise.all([
    Counter.findById('giftNumberA').lean(),
    Counter.findById('giftNumberB').lean(),
  ]);
  return {
    giftNumberA: counterA?.seq || 0,
    giftNumberB: counterB?.seq || 0,
    giftNumberALabel: String(counterA?.seq || 0).padStart(6, '0'),
    giftNumberBLabel: String(counterB?.seq || 0).padStart(6, '0'),
  };
}

async function updateCounters({ giftNumberA, giftNumberB }) {
  const updates = [];
  if (giftNumberA !== undefined) {
    const seq = Math.max(0, Math.floor(Number(giftNumberA)));
    updates.push(
      Counter.findByIdAndUpdate('giftNumberA', { seq }, { upsert: true, new: true })
    );
  }
  if (giftNumberB !== undefined) {
    const seq = Math.max(0, Math.floor(Number(giftNumberB)));
    updates.push(
      Counter.findByIdAndUpdate('giftNumberB', { seq }, { upsert: true, new: true })
    );
  }
  await Promise.all(updates);
  return getCounters();
}

async function getDailyInventory(dateKey) {
  const row = await GiftInventory.findOne({ dateKey }).lean();
  return {
    dateKey,
    giftARemaining: row?.giftARemaining ?? 0,
    giftBRemaining: row?.giftBRemaining ?? 0,
    giftAIssued: row?.giftAIssued ?? 0,
    giftBIssued: row?.giftBIssued ?? 0,
    morningRefillApplied: !!row?.morningRefillApplied,
  };
}

async function countPlayersForDate(dateKey) {
  const [registrationCount, distinctEmails] = await Promise.all([
    Registration.countDocuments({ dateKey }),
    Registration.distinct('email', { dateKey }),
  ]);
  const playedCount = await GameResult.countDocuments({ dateKey });
  return {
    registrations: registrationCount,
    uniqueEmails: distinctEmails.length,
    gamesCompleted: playedCount,
  };
}

async function getEmailList({ dateKey, page = 1, limit = 50 }) {
  const filter = dateKey ? { dateKey } : {};
  const skip = (Math.max(1, page) - 1) * limit;
  const [items, total] = await Promise.all([
    Registration.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Math.min(100, Math.max(1, limit)))
      .lean(),
    Registration.countDocuments(filter),
  ]);

  const sessionIds = [...new Set(items.map((r) => r.sessionId))].filter((id) =>
    mongoose.isValidObjectId(id)
  );
  const results = await GameResult.find({
    session: { $in: sessionIds.map((id) => new mongoose.Types.ObjectId(id)) },
  })
    .select('session score giftType giftNumber giftStatus dateKey')
    .lean();

  const resultBySession = new Map(results.map((r) => [String(r.session), r]));

  return {
    items: items.map((row) => {
      const result = resultBySession.get(row.sessionId);
      return {
        email: row.email,
        sessionId: row.sessionId,
        dateKey: row.dateKey,
        canClaimPrize: row.canClaimPrize,
        registeredAt: row.createdAt,
        score: result?.score ?? null,
        giftType: result?.giftType ?? null,
        giftNumber: result?.giftNumber ?? null,
        giftStatus: result?.giftStatus ?? null,
      };
    }),
    total,
    page,
    limit,
  };
}

async function getOverview(dateKey = getDateKey()) {
  const [availability, counters, dailyInventory, players, giftResults, scoreSettings] = await Promise.all([
    getGiftAvailability(),
    getCounters(),
    getDailyInventory(dateKey),
    countPlayersForDate(dateKey),
    GameResult.aggregate([
      { $match: { dateKey, giftStatus: 'awarded', giftType: { $in: ['A', 'B'] } } },
      { $group: { _id: '$giftType', count: { $sum: 1 } } },
    ]),
    getGiftScoreSettings(),
  ]);

  const awardedFromResults = { A: 0, B: 0 };
  giftResults.forEach((row) => {
    awardedFromResults[row._id] = row.count;
  });

  return {
    dateKey,
    timezone: 'Asia/Hong_Kong',
    players,
    giftsDispatched: {
      A: dailyInventory.giftAIssued,
      B: dailyInventory.giftBIssued,
      awardedFromResults,
    },
    inventory: {
      today: dailyInventory,
      current: {
        giftARemaining: availability.giftA.remaining,
        giftBRemaining: availability.giftB.remaining,
        giftAIssued: availability.giftA.issued,
        giftBIssued: availability.giftB.issued,
        totalRemaining: availability.giftA.remaining + availability.giftB.remaining,
        withinHours: availability.withinHours,
        available: availability.available,
        distributionStart: availability.distributionStart,
        distributionEnd: availability.distributionEnd,
      },
    },
    counters,
    scoreSettings,
  };
}

async function getDailyHistory(days = 7) {
  const rows = await GiftInventory.find()
    .sort({ dateKey: -1 })
    .limit(Math.min(30, Math.max(1, days)))
    .lean();

  const dateKeys = rows.map((r) => r.dateKey);
  const playerCounts = await Registration.aggregate([
    { $match: { dateKey: { $in: dateKeys } } },
    { $group: { _id: '$dateKey', registrations: { $sum: 1 }, emails: { $addToSet: '$email' } } },
  ]);
  const playerMap = new Map(
    playerCounts.map((p) => [p._id, { registrations: p.registrations, uniqueEmails: p.emails.length }])
  );

  return rows.map((row) => ({
    dateKey: row.dateKey,
    giftAIssued: row.giftAIssued,
    giftBIssued: row.giftBIssued,
    giftARemaining: row.giftARemaining,
    giftBRemaining: row.giftBRemaining,
    players: playerMap.get(row.dateKey) || { registrations: 0, uniqueEmails: 0 },
  }));
}

module.exports = {
  getOverview,
  getEmailList,
  getCounters,
  updateCounters,
  getDailyHistory,
  getDateKey,
};
