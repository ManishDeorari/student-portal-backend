const mongoose = require("mongoose");

const AlumniSchema = new mongoose.Schema({
  name: { type: String, required: true },
  year: { type: Number, required: true },
  job: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.models.Alumni || mongoose.model("Alumni", AlumniSchema);
