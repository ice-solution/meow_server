const mongoose = require('mongoose');

const giftScoreSettingsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'global' },
    minPrizeScore: { type: Number, default: 100 },
    giftAMaxScore: { type: Number, default: 400 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('GiftScoreSettings', giftScoreSettingsSchema);
