const Post = require("../../../../models/Post");
const User = require("../../../../models/User");
const PointsSystemConfig = require("../../../../models/PointsSystemConfig");

const createPost = async (req, res) => {
  try {
    const { content, images, video, documents, type, sessionDetails, announcementDetails, pointsRequested, pointsStatus } = req.body;
    const userRole = req.user.role;
    const isAdmin = req.user.isAdmin;

    const hasContent = content?.trim()?.length > 0;
    const hasImages = Array.isArray(images) && images.length > 0;
    const hasVideo = video?.url;

    if (!hasContent && !hasImages && !hasVideo) {
      return res.status(400).json({ message: "Post must contain text or media." });
    }

    // Role-based validation for post type
    let finalType = "Regular";
    if (type && type !== "Regular") {
      if (type === "Session" && userRole === "student") {
        finalType = "Session";
      } else if (type === "EventRepost" && userRole === "student") {
        finalType = "EventRepost";
      } else if (type === "Event" && (userRole === "faculty" || isAdmin)) {
        finalType = "Event";
      } else if (type === "Announcement" && (userRole === "faculty" || isAdmin)) {
        finalType = "Announcement";
      } else {
        return res.status(403).json({ message: `You are not authorized to create a post of type ${type}` });
      }
    }

    let finalAnnouncementDetails = null;

    if (finalType === "Announcement" && announcementDetails) {
      finalAnnouncementDetails = {
        isWinnerAnnouncement: announcementDetails.isWinnerAnnouncement || false,
        isAchievementAnnouncement: announcementDetails.isAchievementAnnouncement || false,
        achievementCategory: announcementDetails.achievementCategory || "",
        eventName: announcementDetails.eventName || "",
        originalEventId: announcementDetails.originalEventId || undefined,
        winners: announcementDetails.winners || [],
      };

      // Search for userId by name or uniqueId for winners/achievers
      if ((finalAnnouncementDetails.isWinnerAnnouncement || finalAnnouncementDetails.isAchievementAnnouncement) && finalAnnouncementDetails.winners.length > 0) {
        for (let winner of finalAnnouncementDetails.winners) {
          if (winner.uniqueId) {
            const matchedUser = await User.findOne({
              $or: [{ publicId: winner.uniqueId }, { enrollmentNumber: winner.uniqueId }]
            });
            if (matchedUser) winner.userId = matchedUser._id;
          } 
          if (!winner.userId && winner.name) {
            const matchedUser = await User.findOne({ name: { $regex: new RegExp(`^${winner.name}$`, "i") } });
            if (matchedUser) winner.userId = matchedUser._id;
          }
        }
      }
    }

    const { eventRepostDetails } = req.body; // Extract eventRepostDetails if passed

    const post = new Post({
      user: req.user._id || req.user.id,
      content: hasContent ? content.trim() : "",
      images: hasImages ? images : [],
      video: hasVideo ? video : null,
      documents: Array.isArray(documents) ? documents : [],
      type: finalType,
      sessionDetails: finalType === "Session" ? sessionDetails : undefined,
      announcementDetails: finalAnnouncementDetails,
      eventRepostDetails: finalType === "EventRepost" ? eventRepostDetails : undefined,
      pointsRequested: (finalType === "Session" && pointsRequested) || (finalType === "Announcement" && announcementDetails?.pointsRequested) || (finalType === "EventRepost") || false,
      pointsStatus: ((finalType === "Session" && pointsRequested) || (finalType === "Announcement" && announcementDetails?.pointsRequested) || finalType === "EventRepost") ? "pending" : "none",
    });

    await post.save();
    const postPopulateOptions = require("../utils/populatePost");

    const populated = await Post.findById(post._id)
      .populate(postPopulateOptions);
    
    req.io?.emit("postCreated", populated);

    // ✅ NEW: Broadcast persistent notification for Announcements to all Staff (Admin/Faculty)
    if (finalType === "Announcement") {
      const { notifyStaff } = require("../../../../utils/notificationHelper");
      const creatorName = populated.user?.name || "A user";
      await notifyStaff(
        req.io,
        req.user._id || req.user.id,
        "admin_notice",
        `${creatorName} posted an official Announcement: "${announcementDetails?.eventName || "Event Details"}"`,
        { postId: post._id }
      );
    }

    // ✅ NEW: Notification to original Event Owner on EventRepost
    if (finalType === "EventRepost" && eventRepostDetails?.originalEventId) {
      try {
        const EventModel = mongoose.models.Event || mongoose.model("Event");
        const origEvent = await EventModel.findById(eventRepostDetails.originalEventId).select("createdBy title");
        if (origEvent && origEvent.createdBy) {
          const Notification = require("../../../../models/Notification");
          const creatorName = populated.user?.name || "A user";
          const newNotification = new Notification({
            sender: req.user._id || req.user.id,
            receiver: origEvent.createdBy,
            type: "event_repost",
            message: `${creatorName} reposted your event: "${origEvent.title || "Event"}"`,
            postId: post._id,
          });
          await newNotification.save();
          if (req.io) {
            const populatedNotification = await Notification.findById(newNotification._id).populate("sender", "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded");
            const targetRoom = origEvent.createdBy.toString();
            req.io.to(targetRoom).emit("newNotification", populatedNotification);
            req.io.to(targetRoom).emit("liveNotification", populatedNotification);
          }
        }
      } catch (e) {
        console.error("Failed to notify original event owner on repost:", e);
      }
    }

    // ✅ Award Points Logic
    if (finalType !== "EventRepost" && (userRole === "student" || userRole === "alumni")) {
      try {
        const user = await User.findById(req.user._id || req.user.id);
        const PointsSystemConfig = require("../../../../models/PointsSystemConfig");
        const config = (await PointsSystemConfig.findOne()) || { postPoints: 10, maxPostsPerDay: 5 };
        
        const now = new Date();
        const limitMs = (config.postLimitHours || 24) * 60 * 60 * 1000;

        // Filter logs to find those within the limit window
        const recentLogs = (user.postPointLogs || []).filter(date => (now - new Date(date)) < limitMs);

        if (recentLogs.length < (config.postLimitCount || 3)) {
          // Award points
          if (!user.points) user.points = { total: 0 };
          user.points.total = (user.points.total || 0) + (config.postPoints || 10);

          // Add to category
          if (user.points.contentContribution === undefined) user.points.contentContribution = 0;
          user.points.contentContribution += (config.postPoints || 10);

          // Update logs
          if (!user.postPointLogs) user.postPointLogs = [];
          user.postPointLogs.push(now);

          await user.save();

          // ✅ Notification for points
          try {
            const Notification = require("../../../../models/Notification");
            const newNotification = new Notification({
              sender: user._id,
              receiver: user._id,
              type: "points_earned",
              message: `You earned ${config.postPoints || 10} points by Posting.`,
            });
            await newNotification.save();

            if (req.io) {
              const populatedNotification = await Notification.findById(newNotification._id).populate("sender", "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded");
              const targetRoom = user._id.toString();
              req.io.to(targetRoom).emit("newNotification", populatedNotification);
              req.io.to(targetRoom).emit("liveNotification", populatedNotification);
            }
          } catch (noteErr) {
            console.error("❌ Failed to send post placement award notice:", noteErr.message);
          }

          console.log(`✅ Awarded ${config.postPoints} points to user ${user.name} for posting.`);
        } else {
          console.log(`ℹ️ Post limit reached for user ${user.name}, no points awarded.`);
        }
      } catch (awardErr) {
        console.error("❌ Failed to award points:", awardErr.message);
      }
    }

    res.status(201).json({ post: populated });

    console.log("🖼️ Received images:", images);
  } catch (err) {
    console.error("❌ Post creation failed:", err);
    res.status(500).json({ message: "Failed to create post" });
  }
};

module.exports = createPost;
