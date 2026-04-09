const express = require("express");
const router = express.Router();
const authenticate = require("../../middleware/authMiddleware");
const Connect = require("../../models/Connect");
const User = require("../../models/User");
const PointsSystemConfig = require("../../models/PointsSystemConfig");

router.post("/", authenticate, async (req, res) => {
  try {
    const to = req.user._id;
    const { from } = req.body;

    const receiver = await User.findById(to);
    const sender = await User.findById(from);

    if (!receiver || !sender) {
      return res.status(404).json({ message: "User not found" });
    }

    // Find the pending request in Connect model
    const connection = await Connect.findOneAndUpdate(
      { from, to, status: "pending" },
      { status: "accepted" },
      { new: true }
    );

    if (!connection) {
      // Logic fallback: check if it's already in pendingRequests array even if Connect doc missing
      const pendStr = (receiver.pendingRequests || []).map(id => id.toString());
      if (!pendStr.includes(from)) {
        return res.status(404).json({ message: "No pending request found" });
      }
    }

    // Update User arrays
    receiver.pendingRequests = (receiver.pendingRequests || []).filter(id => id.toString() !== from);
    sender.sentRequests = (sender.sentRequests || []).filter(id => id.toString() !== to.toString());

    const myConnStr = (receiver.connections || []).map(id => id.toString());
    const senderConnStr = (sender.connections || []).map(id => id.toString());

    if (!myConnStr.includes(from)) receiver.connections.push(from);
    if (!senderConnStr.includes(to.toString())) sender.connections.push(to);

    // Notification for the requester (Sender)
    const Notification = require("../../models/Notification");
    const acceptNoteForSender = new Notification({
      sender: to,
      receiver: from,
      type: "connect_accept",
      message: `${receiver.name} accepted your connection request`,
    });
    await acceptNoteForSender.save();

    // Reciprocal Notification for the acceptor (Current User)
    const acceptNoteForReceiver = new Notification({
      sender: from,
      receiver: to,
      type: "connect_accept",
      message: `You are now connected with ${sender.name}`,
    });
    await acceptNoteForReceiver.save();

    // Emit socket events
    if (req.io) {
      // Notify the requester
      const populatedSenderNote = await Notification.findById(acceptNoteForSender._id).populate("sender", "name profilePicture");
      req.io.to(from.toString()).emit("newNotification", populatedSenderNote);
      req.io.to(from.toString()).emit("liveNotification", populatedSenderNote);

      // Notify the acceptor (live update for their own feed/preview)
      const populatedReceiverNote = await Notification.findById(acceptNoteForReceiver._id).populate("sender", "name profilePicture");
      req.io.to(to.toString()).emit("newNotification", populatedReceiverNote);
      req.io.to(to.toString()).emit("liveNotification", populatedReceiverNote);
    }

    await receiver.save();
    await sender.save();

    // ✅ Award Points Logic
    const config = await PointsSystemConfig.findOne() || { connectionPoints: 10 };
    const pointsToAdd = config.connectionPoints || 10;

    const awardPoints = async (user) => {
      if (user.role === "alumni") {
        if (!user.points) user.points = { total: 0 };
        user.points.total = (user.points.total || 0) + pointsToAdd;

        if (user.points.connections === undefined) user.points.connections = 0;
        user.points.connections += pointsToAdd;

        // Also keep studentEngagement if it's considered part of it, but user wants granular.
        user.points.studentEngagement += pointsToAdd;

        await user.save();

        // ✅ Notification for points
        try {
          const Notification = require("../../models/Notification");
          const newNotification = new Notification({
            sender: user._id,
            receiver: user._id,
            type: "points_earned",
            message: `You earned ${pointsToAdd} points by Networking.`,
          });
          await newNotification.save();

          if (req.io) {
            const populatedNotification = await Notification.findById(newNotification._id).populate("sender", "name profilePicture");
            const targetRoom = user._id.toString();
            req.io.to(targetRoom).emit("newNotification", populatedNotification);
            req.io.to(targetRoom).emit("liveNotification", populatedNotification);
          }
        } catch (noteErr) {
          console.error("❌ Failed to send networking award notice:", noteErr.message);
        }
      }
    };

    await awardPoints(receiver);
    await awardPoints(sender);

    res.status(200).json({ message: "Connection request accepted" });
  } catch (err) {
    console.error("Accept Request Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
