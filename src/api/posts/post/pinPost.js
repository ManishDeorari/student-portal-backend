const Post = require("../../../../models/Post");
const Event = require("../../../../models/Event");

const pinPost = async (req, res) => {
  try {
    let post = await Post.findById(req.params.id);
    let isEvent = false;
    
    if (!post) {
      post = await Event.findById(req.params.id);
      isEvent = true;
    }
    
    if (!post) {
      return res.status(404).json({ message: "Post or Event not found" });
    }

    // Only allow Admins to pin posts
    const isAdmin = req.user.role === 'admin' || req.user.isAdmin || req.user.isMainAdmin || req.user.email === "manishdeorari377@gmail.com";
    if (!isAdmin) {
      return res.status(403).json({ message: "Only admins can pin posts/events." });
    }

    if (!post.isPinned) {
      const pinnedPostCount = await Post.countDocuments({ isPinned: true });
      const pinnedEventCount = await Event.countDocuments({ isPinned: true });
      
      if (pinnedPostCount + pinnedEventCount >= 3) {
        return res.status(400).json({ message: "You can only pin up to 3 posts/events at a time." });
      }
    }

    post.isPinned = !post.isPinned; // Toggle
    await post.save();

    const io = req.app.get("io");
    if (io) {
      io.emit("postUpdated", { _id: post._id, isPinned: post.isPinned });
    }

    res.json({ message: post.isPinned ? "Pinned successfully" : "Unpinned successfully", isPinned: post.isPinned });
  } catch (error) {
    console.error("Error pinning post:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = pinPost;
