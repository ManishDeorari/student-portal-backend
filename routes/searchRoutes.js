const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");

const User = require("../models/User");
const Post = require("../models/Post");
const Event = require("../models/Event");

router.get("/", auth, async (req, res) => {
  try {
    const query = req.query.q;
    if (!query || query.trim().length < 2) {
      return res.json({ users: [], posts: [], events: [] });
    }

    const regex = new RegExp(query, "i");

    // Search Users
    const users = await User.find({
      $or: [
        { name: regex },
        { enrollmentNumber: regex },
        { "profile.skills": regex }
      ]
    }).select("name profilePicture role enrollmentNumber branch").limit(5);

    // Search Posts
    const posts = await Post.find({
      $or: [
        { title: regex },
        { content: regex },
        { "announcementDetails.winners.name": regex }
      ]
    })
    .populate("user", "name profilePicture")
    .limit(5);

    // Search Events
    const events = await Event.find({
      $or: [
        { title: regex },
        { description: regex },
        { location: regex }
      ]
    })
    .populate("createdBy", "name profilePicture")
    .limit(5);

    res.json({
      users,
      posts,
      events
    });
  } catch (error) {
    console.error("Global search error:", error);
    res.status(500).json({ message: "Search failed" });
  }
});

module.exports = router;
