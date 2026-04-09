const Post = require("../../../../models/Post");

const getMyPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    // Filter by the logged-in user
    const posts = await Post.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("user", "name profilePicture")
      .populate({ path: "comments.user", select: "name profilePicture" })
      .populate({ path: "comments.replies.user", select: "name profilePicture" })
      .populate({ path: "announcementDetails.winners.userId", select: "name profilePicture publicId" })
      .populate({ path: "announcementDetails.winners.groupMembers", select: "name profilePicture" });

    const total = await Post.countDocuments({ user: req.user._id });

    res.json({ posts, total });
  } catch (err) {
    console.error("❌ Fetch my posts failed:", err);
    res.status(500).json({ message: "Failed to fetch my posts" });
  }
};

module.exports = getMyPosts;
