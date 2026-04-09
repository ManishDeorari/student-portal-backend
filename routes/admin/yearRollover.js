const express = require("express");
const router = express.Router();
const User = require("../../models/User");
const authenticate = require("../../middleware/authMiddleware");
const RolloverConfig = require("../../models/RolloverConfig");

// Admin guard
const verifyAdmin = async (req, res, next) => {
  const user = await User.findById(req.user._id);
  if (!user || !user.isAdmin) {
    return res.status(403).json({ message: "Admins only" });
  }
  next();
};

// ✅ YEAR END ROLLOVER
router.post("/year-end-rollover", authenticate, verifyAdmin, async (req, res) => {
  try {
    const currentYear = new Date().getFullYear().toString();
    const now = new Date();

    const config = await RolloverConfig.findOne({ year: currentYear });

    if (!config) {
      return res.status(400).json({ message: "Rollover not configured for this year" });
    }

    if (config.hasExecuted) {
      return res.status(400).json({ message: "Rollover already executed for this year" });
    }

    if (now < config.startDate || now > config.endDate) {
      return res.status(403).json({
        message: "Rollover not allowed outside configured date range",
        allowedFrom: config.startDate,
        allowedTill: config.endDate,
      });
    }

    const alumniUsers = await User.find({ role: "alumni" });

    for (const user of alumniUsers) {
      user.lastYearPoints = {
        year: currentYear,
        total: user.points.total,
      };

      user.points = {
        profileCompletion: 0,
        studentEngagement: 0,
        referrals: 0,
        contentContribution: 0,
        campusEngagement: 0,
        innovationSupport: 0,
        alumniParticipation: 0,
        total: 0,
      };

      user.profileCompletionAwarded = false; // Reset so they can re-earn 50 points

      await user.save();
    }

    config.hasExecuted = true;
    config.executedAt = now;
    await config.save();

    res.json({
      message: "✅ Year-end rollover completed",
      usersProcessed: alumniUsers.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Year-end rollover failed" });
  }
});


module.exports = router;
