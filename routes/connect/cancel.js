// routes/connect/cancel.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middleware/authMiddleware");
const User = require("../../models/User");

const Connect = require("../../models/Connect");

router.post("/", authMiddleware, async (req, res) => {
  const from = req.user._id;
  const { toUserId: to } = req.body;

  try {
    const sender = await User.findById(from);
    const receiver = await User.findById(to);

    if (!receiver || !sender) return res.status(404).json({ message: "User not found" });

    // Remove from User arrays
    sender.sentRequests = (sender.sentRequests || []).filter(id => id.toString() !== to.toString());
    receiver.pendingRequests = (receiver.pendingRequests || []).filter(id => id.toString() !== from.toString());

    // Also remove from Connect model
    await Connect.findOneAndDelete({ from, to, status: "pending" });

    await sender.save();
    await receiver.save();

    res.json({ message: "Request canceled" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
