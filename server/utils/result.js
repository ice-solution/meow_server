const { getPrizeInfo } = require('../services/giftInventory');
const { formatGiftNumber } = require('./giftNumber');

function buildResultPayload(session) {
  const prize = session.giftType ? getPrizeInfo(session.giftType) : null;
  const giftNumber = formatGiftNumber(session.giftNumber);
  return {
    sessionId: String(session._id),
    score: session.score,
    giftType: session.giftType,
    giftNumber,
    giftStatus: session.giftStatus || (giftNumber ? 'awarded' : 'none'),
    prizeName: session.prizeName || prize?.name || null,
    prizeAsset: session.prizeAsset || prize?.asset || null,
    hasPrize: !!giftNumber,
  };
}

module.exports = { buildResultPayload };
