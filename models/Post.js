const mongoose = require("mongoose");

const replySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  text: String,
  createdAt: { type: Date, default: Date.now },
  reactions: {
    type: Map,
    of: [mongoose.Schema.Types.ObjectId],
    default: () => new Map(),
  },
  parentId: { // ✅ REQUIRED for correct frontend URL generation
    type: mongoose.Schema.Types.ObjectId,
    ref: "Comment",
    required: true,
  },
});

const commentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  text: String,
  createdAt: { type: Date, default: Date.now },
  reactions: {
    type: Map,
    of: [mongoose.Schema.Types.ObjectId],
    default: () => new Map(),
  },
  replies: [replySchema],
});

const postSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, required: true },
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
  comments: [commentSchema],
  reactions: {
    type: Map,
    of: [mongoose.Schema.Types.ObjectId],
    default: () => new Map(),
  },
  type: {
    type: String,
    enum: ["Regular", "Session", "Event", "Announcement"],
    default: "Regular",
  },
  pointsRequested: { type: Boolean, default: false },
  pointsStatus: { type: String, enum: ["pending", "approved", "rejected", "none"], default: "none" },
  announcementDetails: {
    isWinnerAnnouncement: { type: Boolean, default: false },
    eventName: String, // e.g. "Alumni Meet 2024"
    winners: [
      {
        name: String,
        rank: String,
        points: Number,
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        uniqueId: String, // PublicId or RegistrationNumber
        profilePicture: String,
        isGroup: { type: Boolean, default: false },
        groupId: String,
        groupName: String,
        groupMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      }
    ],
    pointsRequested: { type: Boolean, default: false },
    pointsStatus: { type: String, enum: ["pending", "approved", "rejected", "none"], default: "none" },
  },
  sessionDetails: {
    schoolOrCollege: { type: String },
    campus: { type: String },
    date: { type: String },
    time: { type: String },
  }
}, { timestamps: true });

postSchema.index({ user: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });

const emojiRegex = /^(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Extended_Pictographic})$/u;

postSchema.pre("save", function (next) {
  if (this.reactions) {
    for (const [key, value] of this.reactions.entries()) {
      const strKey = String(key);
      if (!emojiRegex.test(strKey)) {
        this.reactions.delete(key);
        continue;
      }
      if (typeof key !== "string") {
        this.reactions.delete(key);
        this.reactions.set(strKey, value);
      }
    }
  }

  // Normalize each comment.reactions
  this.comments?.forEach((c) => {
    if (c.reactions instanceof Map) {
      for (const [key, value] of c.reactions.entries()) {
        const strKey = String(key);
        if (!emojiRegex.test(strKey)) {
          c.reactions.delete(key);
          continue;
        }
        if (typeof key !== "string") {
          c.reactions.delete(key);
          c.reactions.set(strKey, value);
        }
      }
    }
  });

  next();
});

// 💡 Ensure all Maps are serialized as plain objects when converting
postSchema.methods.toJSON = function () {
  const obj = this.toObject();

  // 🔁 Post reactions
  if (obj.reactions instanceof Map) {
    obj.reactions = Object.fromEntries(obj.reactions);
  }

  // 🔁 Comment reactions + Reply reactions
  if (obj.comments?.length) {
    obj.comments = obj.comments.map((c) => {
      if (c.reactions instanceof Map) {
        c.reactions = Object.fromEntries(c.reactions);
      }

      if (Array.isArray(c.replies)) {
        c.replies = c.replies.map((r) => {
          if (r.reactions instanceof Map) {
            r.reactions = Object.fromEntries(r.reactions);
          }
          return r;
        });
      }

      return c;
    });
  }

  return obj;
};

module.exports = mongoose.model("Post", postSchema);
