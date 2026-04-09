// routes/connect/sent.js
const express = require("express");
const router = express.Router();
const auth = require("../../middleware/authMiddleware");
const Connect = require("../../models/Connect");
const User = require("../../models/User");

router.get("/", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("sentRequests", "name profilePicture course year enrollmentNumber workProfile");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json(user.sentRequests || []);
  } catch (err) {
    console.error("Error in GET /connect/sent:", err.stack);
    res.status(500).json({ message: "Internal server error", error: err.message });
  }
});

module.exports = router;
