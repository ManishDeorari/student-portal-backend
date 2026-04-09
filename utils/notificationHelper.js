const User = require("../models/User");
const Notification = require("../models/Notification");

/**
 * notifyStaff - Broadcast a persistent notification and live socket event to all Admin and Faculty members.
 * 
 * @param {object} io - Socket.io instance from req.io
 * @param {string} senderId - ID of the user performing the action
 * @param {string} type - Notification type from the enum (e.g., 'admin_notice')
 * @param {string} message - Human-readable notification message
 * @param {object} extraData - Optional data (postId, groupId, etc.)
 */
const notifyStaff = async (io, senderId, type, message, extraData = {}) => {
  try {
    // Find all staff members (Admin and Faculty) except the sender
    const staff = await User.find({ 
      role: { $in: ["admin", "faculty"] }, 
      _id: { $ne: senderId } 
    }).select("_id");

    if (!staff.length) return;

    // Create persistent notifications for each staff member
    const notifications = staff.map(u => ({
      sender: senderId,
      receiver: u._id,
      type: type,
      message: message,
      ...extraData,
      createdAt: new Date()
    }));

    const result = await Notification.insertMany(notifications);
    console.log(`📡 [NotificationHelper] Broadcasted ${result.length} staff notifications for type: ${type}`);

    // Emit live socket events to each staff member's personal room
    if (io) {
      for (const notification of result) {
        // Populate the sender info for the live UI update
        const populated = await Notification.findById(notification._id)
          .populate("sender", "name profilePicture");
        
        if (populated) {
          io.to(notification.receiver.toString()).emit("newNotification", populated);
        }
      }
    }
  } catch (err) {
    console.error("❌ [NotificationHelper] Failed to broadcast staff notifications:", err.message);
  }
};

module.exports = { notifyStaff };
