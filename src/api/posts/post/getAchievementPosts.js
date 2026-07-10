const Post = require("../../../../models/Post");
const postPopulateOptions = require("../utils/populatePost");
const mongoose = require("mongoose");

const getAchievementPosts = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const posts = await Post.find({
      type: "Announcement",
      "announcementDetails.isAchievementAnnouncement": true,
      "announcementDetails.winners.userId": userId
    })
      .populate(postPopulateOptions)
      .sort({ createdAt: -1 });

    res.json(posts);
  } catch (error) {
    console.error("Error fetching achievement posts:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = getAchievementPosts;
