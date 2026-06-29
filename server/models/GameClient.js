const mongoose = require('mongoose');

const gameClientSchema = new mongoose.Schema(
  {
    clientId: { type: String, required: true, unique: true, trim: true, maxlength: 64 },
    name: { type: String, default: '', trim: true, maxlength: 80 },
    isActive: { type: Boolean, default: true },
    secretHash: { type: String, required: true, select: false },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('GameClient', gameClientSchema);
