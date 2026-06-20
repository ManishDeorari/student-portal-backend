// controllers/user/getMyPosts.js
const Post = require("../../../../models/Post");
const postPopulateOptions = require("../../posts/utils/populatePost");

const getMyPosts = async (req, res) => {
  try {
    const userId = req.user.id; // comes from auth middleware

    const posts = await Post.find({ user: userId })
      .sort({ createdAt: -1 }) // newest → oldest
      .populate(postPopulateOptions);

    res.json(posts);
  } catch (err) {
    console.error("❌ Fetch my posts failed:", err);
    res.status(500).json({ message: "Failed to fetch user posts" });
  }
};

module.exports = getMyPosts;
