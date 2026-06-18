const Post = require("../../../../models/Post");

const editReply = async (req, res) => {
  try {
    const { text } = req.body;
    const { postId, commentId, replyId } = req.params;

    if (!text || text.trim() === "") {
      return res.status(400).json({ message: "Reply text is required" });
    }

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const reply = comment.replies.id(replyId);
    if (!reply) return res.status(404).json({ message: "Reply not found" });

    if (reply.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    reply.text = text.trim();
    reply.editedAt = new Date();
    await post.save();

    const updated = await Post.findById(post._id)
      .populate("user", "name profilePicture profileCompletionAwarded")
      .populate({ path: "comments.user", select: "name profilePicture profileCompletionAwarded" })
      .populate({ path: "comments.replies.user", select: "name profilePicture profileCompletionAwarded" })
      .lean();

    req.io.emit("postUpdated", updated);
    res.json(updated);
  } catch (err) {
    console.error("❌ Edit reply error:", err);
    res.status(500).json({ message: "Failed to edit reply" });
  }
};

module.exports = editReply;
