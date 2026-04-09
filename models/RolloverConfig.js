const mongoose = require("mongoose");

const RolloverConfigSchema = new mongoose.Schema({
  year: { type: String, required: true, unique: true },

  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },

  hasExecuted: {
    type: Boolean,
    default: false,
  },

  executedAt: Date,
});

module.exports = mongoose.model("RolloverConfig", RolloverConfigSchema);
