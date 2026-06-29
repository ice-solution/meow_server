const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    sessionId: { type: String, required: true },
    dateKey: { type: String, required: true, index: true },
    canClaimPrize: { type: Boolean, default: true },
  },
  { timestamps: true }
);

registrationSchema.index({ email: 1, dateKey: 1 });

module.exports = mongoose.model('Registration', registrationSchema);
