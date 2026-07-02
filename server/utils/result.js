const { getPrizeInfo } = require('../services/giftInventory');

function buildResultPayload(session) {
  const prize = session.giftType ? getPrizeInfo(session.giftType) : null;
  return {
    sessionId: String(session._id),
    score: session.score,
    giftType: session.giftType,
    giftNumber: session.giftNumber,
    giftStatus: session.giftStatus || (session.giftNumber ? 'awarded' : 'none'),
    prizeName: session.prizeName || prize?.name || null,
    prizeAsset: session.prizeAsset || prize?.asset || null,
    hasPrize: !!session.giftNumber,
  };
}

module.exports = { buildResultPayload };
