const Post = require("../../../../models/Post");

const editPost = async (req, res) => {
  try {
    const { content, images, video } = req.body;
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    if (post.user.toString() !== req.user.id)
      return res.status(403).json({ message: "Unauthorized" });

    post.content = typeof content === "string" ? content.trim() : post.content;
    post.images = Array.isArray(images) ? images : post.images;
    post.video = video ?? post.video;

    await post.save();

    const postPopulateOptions = require("../utils/populatePost");

    const updatedPost = await Post.findById(post._id)
      .populate(postPopulateOptions);

    req.io.emit("postUpdated", updatedPost);
    res.json(updatedPost);
  } catch (err) {
    console.error("❌ Edit Post error:", err);
    res.status(500).json({ message: "Failed to update post" });
  }
};

module.exports = editPost;
