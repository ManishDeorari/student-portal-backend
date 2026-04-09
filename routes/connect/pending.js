// routes/connect/pending.js

const express = require("express");
const router = express.Router();
const auth = require("../../middleware/authMiddleware"); // Correct relative path
const Connect = require("../../models/Connect");
const User = require("../../models/User");

router.get("/", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate("pendingRequests", "name profilePicture course year enrollmentNumber workProfile");
    res.status(200).json(user.pendingRequests);
  } catch (err) {
    console.error("Error in GET /connect/pending:", err.stack);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
