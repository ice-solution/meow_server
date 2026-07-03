const mongoose = require('mongoose');

const dailyJobLogSchema = new mongoose.Schema(
  {
    job: { type: String, required: true },
    dateKey: { type: String, required: true },
  },
  { timestamps: true }
);

dailyJobLogSchema.index({ job: 1, dateKey: 1 }, { unique: true });

module.exports = mongoose.model('DailyJobLog', dailyJobLogSchema);
