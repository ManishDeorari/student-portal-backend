// controllers/user/getMyPosts.js
const Post = require("../../../../models/Post");

const getMyPosts = async (req, res) => {
  try {
    const userId = req.user.id; // comes from auth middleware

    const posts = await Post.find({ user: userId })
      .sort({ createdAt: -1 }) // newest → oldest
      .populate("user", "name profilePicture")
      .populate({ path: "comments.user", select: "name profilePicture" })
      .populate({ path: "comments.replies.user", select: "name profilePicture" });

    res.json(posts);
  } catch (err) {
    console.error("❌ Fetch my posts failed:", err);
    res.status(500).json({ message: "Failed to fetch user posts" });
  }
};

module.exports = getMyPosts;
