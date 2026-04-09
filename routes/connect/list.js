const express = require("express");
const router = express.Router();
const authenticate = require("../../middleware/authMiddleware");
const Connect = require("../../models/Connect");
const User = require("../../models/User");

router.get("/", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate("connections", "name profilePicture course year enrollmentNumber employeeId publicId workProfile");
    res.status(200).json(user.connections);
  } catch (err) {
    console.error("Connection List Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
