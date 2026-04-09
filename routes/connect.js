const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const ConnectRequest = require("../models/ConnectRequest"); // Create this model
const User = require("../models/User");

// GET /api/connect/pending – Admin view of pending requests
router.get("/pending", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user.isAdmin) {
      return res.status(403).json({ message: "Access denied" });
    }

    const pendingRequests = await ConnectRequest.find({ status: "pending" })
      .populate("from", "name email")
      .populate("to", "name email");

    res.json(pendingRequests);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

module.exports = router;
