const Post = require("../../../../models/Post");

const deleteReply = async (req, res) => {
  try {
    const { postId, commentId, replyId } = req.params;

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const reply = comment.replies.id(replyId);
    if (!reply) return res.status(404).json({ message: "Reply not found" });

    const User = require("../../../../models/User");
    const currentUser = await User.findById(req.user._id || req.user.id);
    const isAdmin = currentUser && (currentUser.isMainAdmin || currentUser.role === 'admin');

    if (reply.user.toString() !== req.user._id.toString() && !isAdmin) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Handle Admin notification if deleting someone else's reply
    if (isAdmin && reply.user.toString() !== req.user._id.toString()) {
      try {
        const Notification = require("../../../../models/Notification");
        const adminNote = new Notification({
          sender: req.user._id,
          receiver: reply.user,
          type: "admin_notice",
          message: `Your reply on a post has been removed by the Admin for violating community guidelines.`,
        });
        await adminNote.save();
        if (req.io) {
          const populatedNotification = await Notification.findById(adminNote._id).populate("sender", "name profilePicture");
          const targetRoom = reply.user.toString();
          req.io.to(targetRoom).emit("newNotification", populatedNotification);
          req.io.to(targetRoom).emit("liveNotification", populatedNotification);
        }
      } catch (noteErr) {
        console.error("❌ Failed to send admin deletion notice:", noteErr.message);
      }
    }

    comment.replies = comment.replies.filter(
      (r) => r._id.toString() !== replyId
    );

    await post.save();

    // ✅ Revoke Points
    try {
      const PointsSystemConfig = require("../../../../models/PointsSystemConfig");
      const config = (await PointsSystemConfig.findOne()) || { commentPoints: 3 }; // using commentPoints/2 or similar if available, else default 2
      const replyPoints = 2; // Fixed value or config if available

      const replyAuthor = await User.findById(reply.user);
      if (replyAuthor && replyAuthor.points) {
        replyAuthor.points.total = Math.max(0, (replyAuthor.points.total || 0) - replyPoints);
        
        if (replyAuthor.points.contentContribution !== undefined) {
          replyAuthor.points.contentContribution = Math.max(0, replyAuthor.points.contentContribution - replyPoints);
        }

        await replyAuthor.save();
        console.log(`✅ Revoked ${replyPoints} points from user ${replyAuthor.name} for reply deletion.`);
      }
    } catch (revokeErr) {
      console.error("❌ Failed to revoke points for reply deletion:", revokeErr.message);
    }

    const updated = await Post.findById(post._id)
      .populate("user", "name profilePicture")
      .populate({ path: "comments.user", select: "name profilePicture" })
      .populate({ path: "comments.replies.user", select: "name profilePicture" })
      .lean();

    req.io.emit("postUpdated", updated);
    res.json(updated);
  } catch (err) {
    console.error("❌ Delete reply error:", err);
    res.status(500).json({ message: "Failed to delete reply" });
  }
};

module.exports = deleteReply;
