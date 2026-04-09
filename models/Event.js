const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  text: String,
  createdAt: { type: Date, default: Date.now },
  reactions: {
    type: Map,
    of: [mongoose.Schema.Types.ObjectId],
    default: () => new Map(),
  },
  replies: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    text: String,
    createdAt: { type: Date, default: Date.now },
    reactions: {
      type: Map,
      of: [mongoose.Schema.Types.ObjectId],
      default: () => new Map(),
    },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: "Comment" },
  }],
}, { 
  toObject: { flattenMaps: true },
  toJSON: { flattenMaps: true }
});

const EventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  images: [
    {
      url: String,
      public_id: String,
    },
  ],
  video: {
    url: String,
    public_id: String,
  },
  startDate: { type: Date, required: true },
  startTime: { type: String, required: true }, // HH:MM AM/PM
  timezone: { type: String, default: "IST" },
  endDate: { type: Date, required: true },
  registrationCloseDate: { type: Date, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  registrationFields: {
    name: { type: Boolean, default: true },
    profileLink: { type: Boolean, default: true },
    enrollmentNumber: { type: Boolean, default: true },
    email: { type: Boolean, default: true },
    phoneNumber: { type: Boolean, default: true },
    course: { type: Boolean, default: true },
    courseYear: { type: Boolean, default: true },
    branchName: { type: Boolean, default: true },
    currentCompany: { type: Boolean, default: true },
    currentCity: { type: Boolean, default: true },
  },
  customQuestions: [
    {
      question: String,
      type: { type: String, default: "text" },
    },
  ],
  allowGroupRegistration: { type: Boolean, default: true },
  showRegistrationInsights: { type: Boolean, default: true },
  reactions: {
    type: Map,
    of: [mongoose.Schema.Types.ObjectId],
    default: () => new Map(),
  },
  comments: [commentSchema],
}, { 
  timestamps: true,
  toObject: { flattenMaps: true },
  toJSON: { flattenMaps: true }
});

// Normalize reactions before saving
const emojiRegex = /^(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Extended_Pictographic})$/u;

EventSchema.pre("save", function (next) {
  if (this.reactions) {
    for (const [key, value] of this.reactions.entries()) {
      const strKey = String(key);
      if (!emojiRegex.test(strKey)) {
        this.reactions.delete(key);
        continue;
      }
    }
  }
  next();
});

module.exports = mongoose.models.Event || mongoose.model("Event", EventSchema);
