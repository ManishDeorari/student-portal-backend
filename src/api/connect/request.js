// routes/connect.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middleware/authMiddleware");
const User = require("../../models/User");

router.post("/request", authMiddleware, async (req, res) => {
  const { toUserId } = req.body;

  try {
    const fromUser = await User.findById(req.user.id);
    const toUser = await User.findById(toUserId);

    if (!toUser) return res.status(404).json({ message: "User not found" });

    // Ensure networking arrays exist
    if (!toUser.pendingRequests) toUser.pendingRequests = [];
    if (!fromUser.sentRequests) fromUser.sentRequests = [];

    // Avoid duplicates
    if (toUser.pendingRequests.includes(fromUser._id)) {
      return res.status(400).json({ message: "Request already sent" });
    }

    toUser.pendingRequests.push(fromUser._id);
    fromUser.sentRequests.push(toUser._id);

    await toUser.save();
    await fromUser.save();

    // ✅ Real-time Notification
    const Notification = require("../../models/Notification");
    const newNotification = new Notification({
      sender: fromUser._id,
      receiver: toUser._id,
      type: "connect_request",
      message: `${fromUser.name} sent you a connection request.`,
      createdAt: new Date()
    });

    await newNotification.save();

    if (req.io) {
      const populatedNotification = await Notification.findById(newNotification._id)
        .populate("sender", "name profilePicture");
      req.io.to(toUserId.toString()).emit("newNotification", populatedNotification);
    }

    res.json({ message: "Connection request sent" });
  } catch (err) {
    console.error("❌ Send connection request failed:", err);
    res.status(500).json({ message: err.message });
  }
});
