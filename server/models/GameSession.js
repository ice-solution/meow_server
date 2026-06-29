const mongoose = require('mongoose');

const gameSessionSchema = new mongoose.Schema(
  {
    gameHall: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true, index: true },
    socketCode: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['created', 'connected', 'terms_accepted', 'registered', 'playing', 'completed', 'finished', 'expired'],
      default: 'created',
      index: true,
    },
    termsAcceptedAt: { type: Date, default: null },
    playerConnectedAt: { type: Date, default: null },
    email: { type: String, default: null },
    emailRegisteredAt: { type: Date, default: null },
    canClaimPrize: { type: Boolean, default: null },
    score: { type: Number, default: null },
    giftType: { type: String, default: null },
    giftNumber: { type: String, default: null },
    prizeName: { type: String, default: null },
    prizeAsset: { type: String, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, strict: false }
);

gameSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('GameSession', gameSessionSchema, 'gamesessions');
