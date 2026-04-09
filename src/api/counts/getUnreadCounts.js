const User = require("../../../models/User");
const Post = require("../../../models/Post");
const Group = require("../../../models/Group");
const GroupMessage = require("../../../models/GroupMessage");
const Notification = require("../../../models/Notification");

const getUnreadCounts = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // 1. Unread Posts Count
    const unreadPostsCount = await Post.countDocuments({
      createdAt: { $gt: user.lastSeenPostsAt || new Date(0) },
      user: { $ne: user._id } // Don't count own posts
    });

    // 2. Pending Connection Requests Count
    const pendingRequestsCount = user.pendingRequests ? user.pendingRequests.length : 0;

    // 3. Unread Group Messages Count
    // Find groups the user is a member of
    const joinedGroups = await Group.find({ members: user._id }, "_id");
    const groupIds = joinedGroups.map(g => g._id);
    
    const unreadGroupMessagesCount = await GroupMessage.countDocuments({
      groupId: { $in: groupIds },
      createdAt: { $gt: user.lastSeenGroupsAt || new Date(0) },
      sender: { $ne: user._id } // Don't count own messages
    });

    // 4. Unread Notifications Count
    const unreadNotificationsCount = await Notification.countDocuments({
      receiver: user._id,
      isRead: false
    });

    // 5. Admin Signup Requests Count (only for admins)
    let adminSignupRequestsCount = 0;
    if (user.isAdmin || user.role === "admin") {
      adminSignupRequestsCount = await User.countDocuments({
        approved: false,
        role: { $in: ["alumni", "faculty"] },
        createdAt: { $gt: user.lastSeenAdminRequestsAt || new Date(0) }
      });
    }

    res.json({
      unreadPostsCount,
      pendingRequestsCount,
      unreadGroupMessagesCount,
      unreadNotificationsCount,
      adminSignupRequestsCount
    });
  } catch (err) {
    console.error("Error fetching unread counts:", err);
    res.status(500).json({ message: "Server error fetching counts" });
  }
};

module.exports = getUnreadCounts;
