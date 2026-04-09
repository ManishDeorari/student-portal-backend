const Post = require("../../../../models/Post");

const editComment = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim() === "") {
      return res.status(400).json({ message: "Comment text is required" });
    }

    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    if (comment.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    comment.text = text.trim();
    comment.editedAt = new Date();
    await post.save();

    // ✅ Re-fetch post to enable proper populate
    const updated = await Post.findById(post._id)
      .populate("user", "name profilePicture")
      .populate({ path: "comments.user", select: "name profilePicture" })
      .populate({ path: "comments.replies.user", select: "name profilePicture" })
      .lean();

    req.io.emit("postUpdated", updated);
    res.json(updated);
  } catch (err) {
    console.error("❌ Edit comment error:", err);
    res.status(500).json({ message: "Failed to edit comment" });
  }
};

module.exports = editComment;
