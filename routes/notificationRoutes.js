const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const Notification = require("../models/Notification");
const User = require("../models/User");

// @route   POST api/notifications/feedback
// @desc    Submit user feedback to Main Admin
// @access  Private
router.post("/feedback", auth, async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ message: "Message is required" });

        // Find Main Admin
        const mainAdmin = await User.findOne({ isMainAdmin: true });
        if (!mainAdmin) {
            return res.status(404).json({ message: "Main Admin not found" });
        }

        const newNotification = new Notification({
            sender: req.user._id,
            receiver: mainAdmin._id,
            type: "feedback",
            message: message,
        });

        await newNotification.save();

        // Populate sender info for real-time update
        const populatedNotification = await Notification.findById(newNotification._id)
            .populate("sender", "name profilePicture");

        // Real-time update via socket
        if (req.io) {
            req.io.to(mainAdmin._id.toString()).emit("newNotification", populatedNotification);
        }

        res.status(201).json({ message: "Feedback submitted successfully" });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// @route   GET api/notifications
// @desc    Get all notifications for current user
// @access  Private
router.get("/", auth, async (req, res) => {
    try {
        // 🕒 Auto-cleanup: Delete read notifications older than 60 days
        const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
        await Notification.deleteMany({ 
            receiver: req.user._id, 
            isRead: true, 
            createdAt: { $lt: sixtyDaysAgo } 
        });

        const notifications = await Notification.find({ receiver: req.user._id })
            .populate("sender", "name profilePicture")
            .sort({ createdAt: -1 })
            .limit(50);
        res.json(notifications);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// @route   PATCH api/notifications/read-all
// @desc    Mark all notifications as read
// @access  Private
router.patch("/read-all", auth, async (req, res) => {
    try {
        await Notification.updateMany(
            { receiver: req.user._id, isRead: false },
            { isRead: true }
        );
        res.json({ message: "All notifications marked as read" });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});
 
// @route   DELETE api/notifications/clear-read
// @desc    Delete all read notifications for current user
// @access  Private
router.delete("/clear-read", auth, async (req, res) => {
    try {
        await Notification.deleteMany({ receiver: req.user._id, isRead: true });
        res.json({ message: "Read notifications cleared successfully" });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// @route   PATCH api/notifications/:id/read
// @desc    Mark a notification as read
// @access  Private
router.patch("/:id/read", auth, async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);
        if (!notification) {
            return res.status(404).json({ message: "Notification not found" });
        }

        if (notification.receiver.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: "User not authorized" });
        }

        notification.isRead = true;
        await notification.save();
        res.json(notification);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

module.exports = router;
