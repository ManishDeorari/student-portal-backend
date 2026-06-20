const Post = require("../../../../models/Post");
const Registration = require("../../../../models/Registration");
const Event = require("../../../../models/Event");
const User = require("../../../../models/User");

const getUserEvents = async (req, res) => {
  try {
    let targetUserId = req.params.id;
    if (targetUserId === "me") {
      targetUserId = req.user.id || req.user._id;
    }

    // Try to find if passed id is a publicId
    if (targetUserId && targetUserId.length !== 24) {
      const u = await User.findOne({ publicId: targetUserId });
      if (u) {
        targetUserId = u._id;
      }
    }

    // 1. Fetch participated events from Registrations
    const registrations = await Registration.find({
      $or: [
        { userId: targetUserId },
        { groupMembers: targetUserId }
      ]
    }).populate({ path: "eventId", populate: { path: "createdBy", select: "name profilePicture profileCompletionAwarded publicId" } }).sort({ createdAt: -1 });

    const registeredEvents = registrations.map(reg => {
      if (!reg.eventId) return null;
      const ev = reg.eventId.toObject ? reg.eventId.toObject() : reg.eventId;
      return { ...ev, participationType: "Online Registered" };
    }).filter(e => e);

    // 2. Fetch participated events from EventReposts
    const reposts = await Post.find({
      user: targetUserId,
      type: "EventRepost"
    }).populate({ path: "eventRepostDetails.originalEventId", populate: { path: "createdBy", select: "name profilePicture profileCompletionAwarded publicId" } }).sort({ createdAt: -1 });

    const repostedEvents = reposts
      .map(p => {
        if (!p.eventRepostDetails?.originalEventId) return null;
        return {
          ...p.toObject(),
          isEventRepostPost: true,
          participationType: "Event Repost",
          title: p.eventRepostDetails?.eventName || p.eventRepostDetails?.originalEventId?.title,
          startDate: p.eventRepostDetails?.date || p.eventRepostDetails?.originalEventId?.startDate,
          startTime: p.eventRepostDetails?.time || p.eventRepostDetails?.originalEventId?.startTime,
        };
      })
      .filter(e => e);

    // Combine and deduplicate
    const allParticipatedEventsMap = new Map();
    [...registeredEvents, ...repostedEvents].forEach(ev => {
      if (ev && ev._id) {
        allParticipatedEventsMap.set(ev._id.toString(), ev);
      }
    });
    
    // Sort participated by startDate or createdAt
    const participatedEvents = Array.from(allParticipatedEventsMap.values()).sort((a, b) => {
      return new Date(b.startDate || b.createdAt) - new Date(a.startDate || a.createdAt);
    });

    // 3. Fetch Won Events (Announcements where user is a winner)
    const announcements = await Post.find({
      type: "Announcement",
      $or: [
        { "announcementDetails.winners.userId": targetUserId },
        { "announcementDetails.winners.groupMembers": targetUserId }
      ]
    })
    .populate({ path: "announcementDetails.originalEventId", populate: { path: "createdBy", select: "name profilePicture profileCompletionAwarded publicId" } })
    .populate("user", "name profilePicture profileCompletionAwarded publicId")
    .populate({ path: "announcementDetails.winners.userId", select: "name profilePicture profileCompletionAwarded publicId enrollmentNumber course semester" })
    .populate({ path: "announcementDetails.winners.groupMembers", select: "name profilePicture profileCompletionAwarded publicId" })
    .sort({ createdAt: -1 });

    res.json({
      participatedEvents,
      wonEvents: announcements
    });

  } catch (error) {
    console.error("❌ Error fetching user events:", error.message);
    res.status(500).json({ message: "Server error while fetching user events" });
  }
};

module.exports = getUserEvents;
