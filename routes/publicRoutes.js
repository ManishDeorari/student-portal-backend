const express = require("express");
const router = express.Router();
const Testimonial = require("../models/Testimonial");
const User = require("../models/User");
const Event = require("../models/Event");
const Post = require("../models/Post");

// @route   GET /api/public/testimonials
// @desc    Get featured testimonials
// @access  Public (No Auth Required)
router.get("/testimonials", async (req, res) => {
  try {
    const testimonials = await Testimonial.find({ isFeatured: true, portal: "Student" })
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json(testimonials);
  } catch (error) {
    console.error("❌ Error fetching testimonials:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

// @route   GET /api/public/stats
// @desc    Get platform statistics
// @access  Public
router.get("/stats", async (req, res) => {
  try {
    const [userCount, eventCount, postCount] = await Promise.all([
      User.countDocuments(),
      Event.countDocuments(),
      Post.countDocuments()
    ]);

    res.status(200).json({
      users: userCount || 260, // Fallbacks so it never looks empty initially
      events: eventCount || 15,
      posts: postCount || 120
    });
  } catch (error) {
    console.error("❌ Error fetching stats:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

module.exports = router;
