const express = require("express");
const router = express.Router();
const RolloverConfig = require("../../models/RolloverConfig");
const authenticate = require("../../middleware/authMiddleware");
const User = require("../../models/User");

// admin guard
const verifyAdmin = async (req, res, next) => {
  const user = await User.findById(req.user._id);
  if (!user || !user.isAdmin) {
    return res.status(403).json({ message: "Admins only" });
  }
  next();
};

// ✅ SET / UPDATE ROLLOVER WINDOW
router.post("/rollover/config", authenticate, verifyAdmin, async (req, res) => {
  try {
    const { year, startDate, endDate } = req.body;

    if (!year || !startDate || !endDate) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const config = await RolloverConfig.findOneAndUpdate(
      { year },
      {
        year,
        startDate,
        endDate,
        hasExecuted: false,
      },
      { upsert: true, new: true }
    );

    res.json({
      message: "✅ Rollover window configured",
      config,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to configure rollover" });
  }
});

module.exports = router;
