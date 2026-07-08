const Post = require("../../../../models/Post");
const Notification = require("../../../../models/Notification");

const pinComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const userId = req.user._id;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Check authorization: ONLY the post owner can pin/unpin comments
    if (post.user.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Only the post owner can pin or unpin comments." });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const isCurrentlyPinned = !!comment.isPinned;

    if (!isCurrentlyPinned) {
      // Pinning logic: Enforce limit of 3 pinned comments
      const pinnedCount = post.comments.filter(c => c.isPinned).length;
      if (pinnedCount >= 3) {
        return res.status(400).json({ message: "You can only pin up to 3 comments." });
      }
      comment.isPinned = true;
    } else {
      // Unpinning logic
      comment.isPinned = false;
    }

    post.markModified("comments");
    await post.save();

    const postPopulateOptions = require("../utils/populatePost");

    // Repopulate post details for socket sync & response
    const updatedPost = await Post.findById(postId)
      .populate(postPopulateOptions);

    // Emit live socket update
    if (req.io) {
      req.io.emit("postUpdated", updatedPost);
    }

    // Trigger Notification for the comment author (if the author is not the post owner)
    if (comment.user.toString() !== userId.toString()) {
      try {
        const type = comment.isPinned ? "comment_pinned" : "comment_unpinned";
        const messageText = comment.isPinned
          ? `${req.user.name} pinned your comment on their post.`
          : `${req.user.name} unpinned your comment on their post.`;

        const newNotification = new Notification({
          sender: userId,
          receiver: comment.user,
          type: type,
          message: messageText,
          postId: postId,
          commentId: commentId
        });

        await newNotification.save();

        if (req.io) {
          const populatedNotification = await Notification.findById(newNotification._id).populate("sender", "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded");
          const targetRoom = comment.user.toString();
          req.io.to(targetRoom).emit("newNotification", populatedNotification);
          req.io.to(targetRoom).emit("liveNotification", populatedNotification);
        }
      } catch (noteErr) {
        console.error("❌ Failed to log pin/unpin notification:", noteErr.message);
      }
    }

    return res.status(200).json(updatedPost);
  } catch (error) {
    console.error("❌ Pin Comment Error:", error.message);
    return res.status(500).json({ message: "Server error toggling pin" });
  }
};

module.exports = pinComment;
