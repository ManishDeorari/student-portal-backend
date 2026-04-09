const express = require("express");
const router = express.Router();
const authenticate = require("../../middleware/authMiddleware");
const Connect = require("../../models/Connect");
const User = require("../../models/User");

router.post("/", authenticate, async (req, res) => {
  try {
    const from = req.user._id;
    const { to } = req.body;

    if (from.toString() === to) {
      return res.status(400).json({ message: "You cannot connect with yourself" });
    }

    const sender = await User.findById(from);
    const receiver = await User.findById(to);

    if (!receiver) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if already connected or requested
    const connStr = (sender.connections || []).map(id => id.toString());
    const sentStr = (sender.sentRequests || []).map(id => id.toString());
    const pendStr = (sender.pendingRequests || []).map(id => id.toString());

    if (connStr.includes(to)) {
      return res.status(400).json({ message: "Already connected" });
    }
    if (sentStr.includes(to)) {
      return res.status(400).json({ message: "Connection request already sent" });
    }
    if (pendStr.includes(to)) {
      return res.status(400).json({ message: "They already sent you a request. Accept it instead." });
    }

    // Update sender and receiver
    sender.sentRequests.push(to);
    receiver.pendingRequests.push(from);

    // Also keep Connect model for history/compatibility if needed, 
    // but the primary logic now relies on User arrays.
    const connection = new Connect({ from, to });
    await connection.save();

    // Send notification to recipient
    const Notification = require("../../models/Notification");
    const newNotification = new Notification({
      sender: from,
      receiver: to,
      type: "connect_request",
      message: `${sender.name} sent you a connection request`,
    });
    await newNotification.save();

    // Emit socket event to the receiver's room
    if (req.io) {
      const populatedNotification = await Notification.findById(newNotification._id).populate("sender", "name profilePicture");
      const targetRoom = to.toString();
      req.io.to(targetRoom).emit("newNotification", populatedNotification);
      req.io.to(targetRoom).emit("liveNotification", populatedNotification);
    }

    await sender.save();
    await receiver.save();

    res.status(201).json({ message: "Connection request sent successfully" });
  } catch (err) {
    console.error("Send Request Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
