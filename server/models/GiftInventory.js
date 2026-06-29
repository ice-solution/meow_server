const mongoose = require('mongoose');

const giftInventorySchema = new mongoose.Schema(
  {
    dateKey: { type: String, required: true, unique: true, index: true },
    giftARemaining: { type: Number, default: 50 },
    giftBRemaining: { type: Number, default: 50 },
    giftAIssued: { type: Number, default: 0 },
    giftBIssued: { type: Number, default: 0 },
    morningRefillApplied: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('GiftInventory', giftInventorySchema);
