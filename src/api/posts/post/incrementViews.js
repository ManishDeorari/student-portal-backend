const Post = require("../../../../models/Post");

const incrementViews = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const userId = req.user._id || req.user.id;
    
    // Add to viewedBy array if not already present
    if (!post.viewedBy.includes(userId)) {
      post.viewedBy.push(userId);
      await post.save();
    }

    res.json({ message: "View recorded", views: post.viewedBy.length });
  } catch (error) {
    console.error("Error incrementing views:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = incrementViews;
