const mongoose = require("mongoose");

const PointsSystemConfigSchema = new mongoose.Schema({
    profileCompletionPoints: { type: Number, default: 50 },
    connectionPoints: { type: Number, default: 10 },
    postPoints: { type: Number, default: 10 },
    commentPoints: { type: Number, default: 3 },
    likePoints: { type: Number, default: 2 },
    postLimitCount: { type: Number, default: 3 },
    postLimitDays: { type: Number, default: 7 },
    likeLimitCount: { type: Number, default: 10 },
    likeLimitDays: { type: Number, default: 1 },
    commentLimitCount: { type: Number, default: 5 },
    commentLimitDays: { type: Number, default: 1 },
    sessionPoints: { type: Number, default: 30 },
    rolloverDate: { type: Date },
    lastRolloverExecutedAt: { type: Date },
});

module.exports = mongoose.model("PointsSystemConfig", PointsSystemConfigSchema);
