const mongoose = require('mongoose');

const gameResultSchema = new mongoose.Schema(
  {
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'GameSession', required: true, index: true },
    section: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true, index: true },
    email: { type: String, default: null },
    score: { type: Number, required: true },
    giftType: { type: String, default: null },
    giftNumber: { type: String, default: null },
    prizeName: { type: String, default: null },
    prizeAsset: { type: String, default: null },
    giftStatus: { type: String, default: null },
    dateKey: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('GameResult', gameResultSchema);
