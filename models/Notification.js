const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: {
    type: String,
    required: true,
    enum: [
      "connect_request", 
      "connect_accept", 
      "connect_reject",
      "post_like", 
      "post_comment", 
      "comment_like", 
      "comment_reply", 
      "reply_like", 
      "comment_reaction", 
      "reply_reaction", 
      "profile_visit", 
      "admin_notice",
      "group_joined",
      "group_added",
      "group_removed",
      "group_disbanded",
      "points_earned",
      "feedback",
      "promotion",
      "demotion",
      "account_approved"
    ]
  },
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group" },
  message: { type: String, required: true },
  postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post" },
  commentId: { type: mongoose.Schema.Types.ObjectId }, // Reference within the post.comments array
  replyId: { type: mongoose.Schema.Types.ObjectId }, // Reference within the comment.replies array
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

try {
  mongoose.deleteModel('Notification');
} catch (e) {}

module.exports = mongoose.model("Notification", NotificationSchema);
