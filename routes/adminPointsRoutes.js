const express = require("express");
const router = express.Router();
const User = require("../models/User");
const auth = require("../middleware/authMiddleware");

// ✅ Route to update a user's points manually
router.post("/assign", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Unauthorized" });

    const { userId, category, value } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.points[category] = value;
    user.points.total = Object.values(user.points).reduce((acc, val) => typeof val === "number" ? acc + val : acc, 0);
    await user.save();

    res.json({ message: "Points updated", user });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Reset all users' points (start of new year)
router.post("/reset", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Unauthorized" });

    const users = await User.find();
    for (let user of users) {
      user.points = {};
      user.points.total = 0;
      await user.save();
    }

    res.json({ message: "All points reset" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
