const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
    profileImage: {
        type: String,
        default: "/default-group.jpg",
    },
    profileImagePublicId: {
        type: String,
    },
    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    }],
    admin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    allowFacultyMessaging: {
        type: Boolean,
        default: false,
    },
    allowAlumniMessaging: {
        type: Boolean,
        default: true,
    },
    isAllMemberGroup: {
        type: Boolean,
        default: false,
    },
    profileImageSettings: {
        x: { type: Number, default: 0 },
        y: { type: Number, default: 0 },
        zoom: { type: Number, default: 1 },
        width: { type: Number, default: 100 },
        height: { type: Number, default: 100 }
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model("Group", groupSchema);
