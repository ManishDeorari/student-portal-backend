const Post = require("../../../../models/Post");

const pinPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Only allow Admins to pin posts
    const isAdmin = req.user.role === 'admin' || req.user.isAdmin || req.user.isMainAdmin || req.user.email === "manishdeorari377@gmail.com";
    if (!isAdmin) {
      return res.status(403).json({ message: "Only admins can pin posts." });
    }

    post.isPinned = !post.isPinned; // Toggle
    await post.save();

    res.json({ message: post.isPinned ? "Post pinned" : "Post unpinned", isPinned: post.isPinned });
  } catch (error) {
    console.error("Error pinning post:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = pinPost;
