const mongoose = require('mongoose');
const Registration = require('../models/Registration');
const GameResult = require('../models/GameResult');

const CSV_HEADERS = [
  'email',
  'dateKey',
  'sessionId',
  'canClaimPrize',
  'registeredAt',
  'score',
  'giftType',
  'giftNumber',
  'giftStatus',
];

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function formatCsvRow(row) {
  return CSV_HEADERS.map((key) => csvEscape(row[key])).join(',');
}

async function fetchAllEmailRows() {
  const items = await Registration.find({}).sort({ createdAt: -1 }).lean();
  const sessionIds = [...new Set(items.map((row) => row.sessionId))].filter((id) =>
    mongoose.isValidObjectId(id)
  );

  const results = await GameResult.find({
    session: { $in: sessionIds.map((id) => new mongoose.Types.ObjectId(id)) },
  })
    .select('session score giftType giftNumber giftStatus')
    .lean();

  const resultBySession = new Map(results.map((row) => [String(row.session), row]));

  return items.map((row) => {
    const result = resultBySession.get(row.sessionId);
    return {
      email: row.email,
      dateKey: row.dateKey,
      sessionId: row.sessionId,
      canClaimPrize: row.canClaimPrize,
      registeredAt: row.createdAt ? new Date(row.createdAt).toISOString() : '',
      score: result?.score ?? '',
      giftType: result?.giftType ?? '',
      giftNumber: result?.giftNumber ?? '',
      giftStatus: result?.giftStatus ?? '',
    };
  });
}

async function buildEmailUsersCsv() {
  const rows = await fetchAllEmailRows();
  const lines = [CSV_HEADERS.join(','), ...rows.map(formatCsvRow)];
  return {
    csv: `${lines.join('\n')}\n`,
    rowCount: rows.length,
    rows,
  };
}

module.exports = {
  buildEmailUsersCsv,
  fetchAllEmailRows,
};
