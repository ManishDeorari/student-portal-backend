const mongoose = require("mongoose");

const RegistrationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
  isGroup: { type: Boolean, default: false },
  groupMembers: { type: [mongoose.Schema.Types.Mixed], default: [] },
  answers: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  registeredAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Ensure a user can only register once for an event
RegistrationSchema.index({ userId: 1, eventId: 1 }, { unique: true });

module.exports = mongoose.models.Registration || mongoose.model("Registration", RegistrationSchema);
