const Post = require("../../../../models/Post");

const deleteComment = async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const User = require("../../../../models/User");
    const currentUser = await User.findById(req.user._id || req.user.id);
    const isAdmin = currentUser && (currentUser.isMainAdmin || currentUser.role === 'admin');

    if (comment.user.toString() !== req.user._id.toString() && !isAdmin) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Handle Admin notification if deleting someone else's comment
    if (isAdmin && comment.user.toString() !== req.user._id.toString()) {
      try {
        const Notification = require("../../../../models/Notification");
        const adminNote = new Notification({
          sender: req.user._id,
          receiver: comment.user,
          type: "admin_notice",
          message: `Your comment on a post has been removed by the Admin for violating community guidelines.`,
        });
        await adminNote.save();
        if (req.io) {
          const populatedNotification = await Notification.findById(adminNote._id).populate("sender", "name profilePicture");
          const targetRoom = comment.user.toString();
          req.io.to(targetRoom).emit("newNotification", populatedNotification);
          req.io.to(targetRoom).emit("liveNotification", populatedNotification);
        }
      } catch (noteErr) {
        console.error("❌ Failed to send admin deletion notice:", noteErr.message);
      }
    }

    // Remove the comment manually
    post.comments = post.comments.filter(
      (c) => c._id.toString() !== req.params.commentId
    );
    await post.save();

    // ✅ Revoke Points
    try {
      const PointsSystemConfig = require("../../../../models/PointsSystemConfig");
      const config = (await PointsSystemConfig.findOne()) || { commentPoints: 3 };
      
      const commentAuthor = await User.findById(comment.user);
      if (commentAuthor && commentAuthor.points) {
        // Subtract points safely
        commentAuthor.points.total = Math.max(0, (commentAuthor.points.total || 0) - (config.commentPoints || 3));
        
        if (commentAuthor.points.comments !== undefined) {
          commentAuthor.points.comments = Math.max(0, commentAuthor.points.comments - (config.commentPoints || 3));
        }
        if (commentAuthor.points.engagement !== undefined) {
          commentAuthor.points.engagement = Math.max(0, commentAuthor.points.engagement - (config.commentPoints || 3));
        }

        if (commentAuthor.commentPointLogs && commentAuthor.commentPointLogs.length > 0) {
          commentAuthor.commentPointLogs.pop();
        }

        await commentAuthor.save();
        console.log(`✅ Revoked ${config.commentPoints} points from user ${commentAuthor.name} for comment deletion.`);
      }
    } catch (revokeErr) {
      console.error("❌ Failed to revoke points for comment deletion:", revokeErr.message);
    }

    // ✅ Re-fetch post to populate user details before socket emit
    const updated = await Post.findById(post._id)
      .populate("user", "name profilePicture")
      .populate({ path: "comments.user", select: "name profilePicture" })
      .populate({ path: "comments.replies.user", select: "name profilePicture" })
      .lean();

    req.io.emit("postUpdated", updated); // send to all sockets
    res.json(updated);
  } catch (err) {
    console.error("❌ Delete comment error:", err);
    res.status(500).json({ message: "Failed to delete comment" });
  }
};

module.exports = deleteComment;
