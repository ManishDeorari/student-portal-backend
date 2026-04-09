const User = require("../../../../models/User");

module.exports = async (req, res) => {
  try {
    const reqParamId = req.params.id;
    const visitorId = req.user?.id;
    const mongoose = require("mongoose");

    let user;
    if (mongoose.isValidObjectId(reqParamId)) {
      user = await User.findOne({ 
          $or: [{ _id: reqParamId }, { publicId: reqParamId }] 
      }).select("-password");
    } else {
      user = await User.findOne({ publicId: reqParamId }).select("-password");
    }

    if (!user) return res.status(404).json({ message: "User not found" });

    // Assign the definitive object ID for internal relationship queries down the chain
    const targetUserId = user._id;

    // 🚀 Visit Tracking Logic
    if (visitorId && visitorId.toString() !== targetUserId.toString()) {
      const now = new Date();
      
      const getISTDateStr = (date) => {
        if (!date) return "";
        return new Intl.DateTimeFormat('en-GB', { 
            timeZone: 'Asia/Kolkata', 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit' 
        }).format(date); // Outputs: "DD/MM/YYYY"
      };

      const todayStrIST = getISTDateStr(now);
      const yearStrIST = todayStrIST.slice(-4);

      if (!user.visitStats) {
        user.visitStats = { totalVisits: 0, todayVisits: 0, lastResetTodayVisitsAt: new Date(0) };
      }
      if (!user.visitors) {
        user.visitors = [];
      }

      let profileUpdated = false;

      // 1. Daily Profile Counter Reset Check (IST)
      const lastResetStrIST = getISTDateStr(new Date(user.visitStats.lastResetTodayVisitsAt || 0));
      if (lastResetStrIST !== todayStrIST) {
        user.visitStats.todayVisits = 0;
        user.visitStats.lastResetTodayVisitsAt = now;
        profileUpdated = true;
      }

      // 2. Process Visitor Action
      const visitorRecord = user.visitors.find(v => v.user && v.user.toString() === visitorId.toString());

      if (visitorRecord) {
        const lastVisitStrIST = getISTDateStr(new Date(visitorRecord.lastVisit));
        const lastVisitYearIST = lastVisitStrIST.slice(-4);

        // If they haven't visited TODAY (IST), increment today's views
        if (lastVisitStrIST !== todayStrIST) {
          user.visitStats.todayVisits += 1;
          profileUpdated = true;
        }

        // If they haven't visited this YEAR (IST), increment total views
        if (lastVisitYearIST !== yearStrIST) {
          user.visitStats.totalVisits += 1;
          profileUpdated = true;
        }

        if (profileUpdated) {
          visitorRecord.lastVisit = now;
        }
      } else {
        // Brand new visitor to this profile
        user.visitStats.todayVisits += 1;
        user.visitStats.totalVisits += 1;
        user.visitors.push({ user: visitorId, lastVisit: now });
        profileUpdated = true;
      }

      if (profileUpdated) {
        user.markModified("visitStats");
        user.markModified("visitors");
        await user.save();
      }

      // 🔔 Send Notification for EVERY visit (as requested by user config)
      await sendVisitNotification(req, visitorId, targetUserId);
    }

    // ✅ Return the complete user object (already excluded password in select)
    // We can return the whole object now since we fixed the profile fetch earlier
    res.json(user);
  } catch (err) {
    console.error("❌ Error fetching public profile:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Helper function to send visit notification
async function sendVisitNotification(req, visitorId, targetUserId) {
  try {
    const Notification = require("../../../../models/Notification");
    const User = require("../../../../models/User");
    
    // 🛑 Duplicate Prevention: Check if a notification was sent in the last 1 minute
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const existingNotification = await Notification.findOne({
      sender: visitorId,
      receiver: targetUserId,
      type: "profile_visit",
      createdAt: { $gte: oneMinuteAgo }
    });

    if (existingNotification) {
      console.log(`⏭️ [Duplication Guard] Skipping redundant notification from ${visitorId} to ${targetUserId}`);
      return;
    }

    const newNotification = new Notification({
      sender: visitorId,
      receiver: targetUserId,
      type: "profile_visit",
      message: `visited your profile.`,
    });
    
    await newNotification.save();
    
    if (req.io) {
      console.log(`📡 [Socket] Attempting to emit notification to ${targetUserId}`);
      const populatedNotification = await Notification.findById(newNotification._id)
        .populate("sender", "name profilePicture");
      
      const room = targetUserId.toString();
      req.io.to(room).emit("newNotification", populatedNotification);
      console.log(`✅ [Socket] Emitted 'newNotification' to room: ${room}`);
    } else {
      console.warn("⚠️ [Socket] req.io not found in visit notification");
    }
  } catch (err) {
    console.error("❌ Failed to send visit notification:", err.message);
  }
}
