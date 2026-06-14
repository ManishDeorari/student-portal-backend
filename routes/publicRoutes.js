const express = require("express");
const router = express.Router();
const Testimonial = require("../models/Testimonial");

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

module.exports = router;
