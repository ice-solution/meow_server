const Registration = require('../models/Registration');
const GameResult = require('../models/GameResult');
const GameSession = require('../models/GameSession');
const GiftInventory = require('../models/GiftInventory');
const { updateCounters } = require('./adminStats');
const { createLogger } = require('../utils/logger');

const log = createLogger('DataReset');

async function clearAllGameData() {
  const [registrations, gameResults, gameSessions, giftInventories] = await Promise.all([
    Registration.deleteMany({}),
    GameResult.deleteMany({}),
    GameSession.deleteMany({}),
    GiftInventory.deleteMany({}),
  ]);

  const counters = await updateCounters({ giftNumberA: 0, giftNumberB: 0 });

  const summary = {
    registrationsDeleted: registrations.deletedCount,
    gameResultsDeleted: gameResults.deletedCount,
    gameSessionsDeleted: gameSessions.deletedCount,
    giftInventoriesDeleted: giftInventories.deletedCount,
    counters,
  };

  log.ok('all game data cleared', summary);
  return summary;
}

module.exports = {
  clearAllGameData,
};
