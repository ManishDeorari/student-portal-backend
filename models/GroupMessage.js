const mongoose = require("mongoose");

const groupMessageSchema = new mongoose.Schema({
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Group",
        required: true,
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    content: {
        type: String,
        default: "",
    },
    mediaUrl: {
        type: String,
    },
    mediaPublicId: {
        type: String,
    },
    type: {
        type: String,
        enum: ["text", "image"],
        default: "text",
    },
    reactions: [{
        emoji: String,
        users: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        }],
    }],
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

groupMessageSchema.index({ groupId: 1, createdAt: -1 });
groupMessageSchema.index({ createdAt: -1 });

module.exports = mongoose.model("GroupMessage", groupMessageSchema);
