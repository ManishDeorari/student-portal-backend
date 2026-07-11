const Post = require("../../../models/Post");
const User = require("../../../models/User");
const Notification = require("../../../models/Notification");

const getPendingPointsRequests = async (req, res) => {
  try {
    const posts = await Post.find({
      $or: [
        { pointsRequested: true, pointsStatus: "pending" },
        { "announcementDetails.pointsRequested": true, "announcementDetails.pointsStatus": "pending" },
        { type: "EventRepost", "eventRepostDetails.pointsRequested": true, "eventRepostDetails.pointsStatus": "pending" }
      ]
    })
    .populate("user", "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded enrollmentNumber")
    .populate({ path: "announcementDetails.winners.userId", select: "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded publicId enrollmentNumber course semester" })
    .populate({ path: "announcementDetails.winners.groupMembers", select: "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded" })
    .populate({ path: "eventRepostDetails.originalEventId", populate: { path: "createdBy", select: "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded publicId" } })
    .populate({ path: "announcementDetails.originalEventId", populate: { path: "createdBy", select: "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded publicId" } })
    .sort({ createdAt: -1 });

    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch points requests" });
  }
};

const approvePointsRequest = async (req, res) => {
  const { postId } = req.params;
  const { action, awardedPoints } = req.body; // 'approve' or 'reject'

  try {
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (action === "reject") {
      post.pointsStatus = "rejected";
      
      let message = "Your points request was declined by the Admin.";
      if (post.type === "Session") {
        message = "Your Student Session points request was declined by the Admin.";
      } else if (post.announcementDetails && post.type === "Announcement") {
        const eventName = post.announcementDetails.eventName || "an event";
        message = `Your points request for event "${eventName}" was declined by the Admin.`;
        post.announcementDetails.pointsStatus = "rejected";
      } else if (post.type === "EventRepost" && post.eventRepostDetails) {
        const eventName = post.eventRepostDetails.eventName || "an event";
        message = `Your attendance points request for "${eventName}" was declined by the Admin.`;
        post.eventRepostDetails.pointsStatus = "rejected";
      }

      // Create Rejection Notification
      const newNotification = new Notification({
        sender: req.user._id,
        receiver: post.user,
        type: "admin_notice",
        message: message,
        postId: post._id
      });
      await newNotification.save();

      // Emit Live Update to the affected user
      if (req.io) {
        const senderInfo = { _id: req.user._id, name: req.user.name, profilePicture: req.user.profilePicture };
        const populatedNotification = await Notification.findById(newNotification._id).populate("sender", "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded");
        req.io.to(post.user.toString()).emit("newNotification", { 
          ...populatedNotification.toObject(), 
          sender: senderInfo 
        });

        // ✅ NEW: Broadcast to other staff members
        const { notifyStaff } = require("../../../utils/notificationHelper");
        await notifyStaff(
          req.io,
          req.user._id || req.user.id,
          "admin_notice",
          `${req.user.name} declined a points request for: "${post.content?.substring(0, 30)}..."`,
          { postId: post._id }
        );
      }

      await post.save();
      return res.json({ message: "Points request rejected" });
    }

    if (action === "approve") {
      const senderInfo = { _id: req.user._id, name: req.user.name, profilePicture: req.user.profilePicture };
      post.pointsStatus = "approved"; // Set root status

      // Case 1: Session Post (Points to Owner)
      if (post.type === "Session") {
        const PointsSystemConfig = require("../../../models/PointsSystemConfig");
        const config = await PointsSystemConfig.findOne() || { sessionPoints: 30 };
        const pointsToAward = awardedPoints !== undefined ? Number(awardedPoints) : (config.sessionPoints || 30);

        const user = await User.findById(post.user);
        if (user) {
          if (!user.points) user.points = { total: 0 };
          user.points.total = (user.points.total || 0) + pointsToAward;
          user.points.campusEngagement = (user.points.campusEngagement || 0) + pointsToAward;
          await user.save();

          const newNotification = new Notification({
            sender: req.user._id,
            receiver: user._id,
            type: "points_earned",
            message: `SESSION_AWARD::${pointsToAward}`,
            postId: post._id
          });
          await newNotification.save();

          if (req.io) {
            const userRoom = user._id.toString();
            req.io.to(userRoom).emit("newNotification", { ...newNotification.toObject(), sender: senderInfo });
            req.io.to(userRoom).emit("pointsUpdated", {
              totalPoints: user.points.total,
              awardedPoints: pointsToAward,
              category: "campusEngagement",
              reason: "Session Approved"
            });
          }
          
          post.pointsStatus = "approved";
          await post.save();
          return res.json({ message: "Session points approved and awarded" });
        }
      }

      // Case 2: Announcement Post (Points to Winners)
      if (post.type === "Announcement" && post.announcementDetails) {
        const winners = post.announcementDetails.winners || [];
        const awardResults = [];

        for (let winner of winners) {
          const pointsToAward = parseInt(winner.points) || 0;
          const targetUserIds = [];

          if (winner.isGroup && Array.isArray(winner.groupMembers)) {
            targetUserIds.push(...winner.groupMembers);
          } else if (winner.userId) {
            targetUserIds.push(winner.userId);
          }

          for (let targetUserId of targetUserIds) {
            const user = await User.findById(targetUserId);
            if (user) {
              if (!user.points) user.points = { total: 0 };
              user.points.total = (user.points.total || 0) + pointsToAward;
              
              const isAchievement = post.announcementDetails?.isAchievementAnnouncement;
              const category = isAchievement ? "innovationSupport" : "studentParticipation";
              
              user.points[category] = (user.points[category] || 0) + pointsToAward;
              await user.save();

              const eventName = post.announcementDetails?.eventName || "an event";
              const rank = winner.rank || winner.roleTitle || "an achiever";

              const newNotification = new Notification({
                sender: req.user._id,
                receiver: user._id,
                type: "points_earned",
                message: `Congratulations! You earned ${pointsToAward} points for being "${rank}" in "${eventName}".`,
                postId: post._id
              });
              await newNotification.save();

              if (req.io) {
                const userRoom = user._id.toString();
                req.io.to(userRoom).emit("newNotification", { ...newNotification.toObject(), sender: senderInfo });
                req.io.to(userRoom).emit("pointsUpdated", {
                  totalPoints: user.points.total,
                  awardedPoints: pointsToAward,
                  category: category,
                  reason: `Achievement in ${eventName}`
                });
              }
              awardResults.push({ name: user.name, status: "awarded", points: pointsToAward });
            }
          }
        }

        post.announcementDetails.pointsStatus = "approved";
        await post.save();
        return res.json({ message: "Announcement points approved and awarded", results: awardResults });
      }

      // Case 3: EventRepost (Points to Reposter)
      if (post.type === "EventRepost" && post.eventRepostDetails) {
        const Event = require("../../../models/Event");
        const event = await Event.findById(post.eventRepostDetails.originalEventId);
        const pointsToAward = event ? (event.pointsAssigned || 10) : 10;

        const user = await User.findById(post.user);
        if (user && !user.eventPointsAwarded?.includes(post.eventRepostDetails.originalEventId)) {
          if (!user.points) user.points = { total: 0 };
          user.points.total = (user.points.total || 0) + pointsToAward;
          
          if (user.role === "alumni") {
            user.points.alumniParticipation = (user.points.alumniParticipation || 0) + pointsToAward;
          } else {
            user.points.studentParticipation = (user.points.studentParticipation || 0) + pointsToAward;
          }

          user.eventPointsAwarded.push(post.eventRepostDetails.originalEventId);
          await user.save();

          const eventName = post.eventRepostDetails.eventName || "the event";
          const newNotification = new Notification({
            sender: req.user._id,
            receiver: user._id,
            type: "points_earned",
            message: `You earned ${pointsToAward} points for attending "${eventName}".`,
            postId: post.eventRepostDetails.originalEventId || post._id
          });
          await newNotification.save();

          if (req.io) {
            const userRoom = user._id.toString();
            req.io.to(userRoom).emit("newNotification", { ...newNotification.toObject(), sender: senderInfo });
            req.io.to(userRoom).emit("pointsUpdated", {
              totalPoints: user.points.total,
              awardedPoints: pointsToAward,
              category: user.role === "alumni" ? "alumniParticipation" : "studentParticipation",
              reason: `Attended ${eventName}`
            });
          }
          
          post.eventRepostDetails.pointsStatus = "approved";
          await post.save();
          return res.json({ message: "Event Repost points approved and awarded" });
        } else if (user && user.eventPointsAwarded?.includes(post.eventRepostDetails.originalEventId)) {
          // Already awarded, just approve post
          post.eventRepostDetails.pointsStatus = "approved";
          await post.save();
          return res.json({ message: "User already received points for this event. Repost approved." });
        }
      }
    }

    res.status(400).json({ message: "Invalid action" });
  } catch (error) {
    console.error("Points approval error:", error);
    res.status(500).json({ message: "Failed to process points request" });
  }
};

const getPendingProfilePointsRequests = async (req, res) => {
  try {
    // 🔗 Points for Resume and Links are now fully automated. Return empty.
    res.json([]);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch profile points requests" });
  }
};

const approveProfilePointsRequest = async (req, res) => {
  const { userId } = req.params;
  const { action, field } = req.body; // action: 'approve' or 'reject', field: 'resume', 'github', or 'portfolio'

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const statusField = `${field}PointsStatus`;
    if (user[statusField] !== "pending") {
      return res.status(400).json({ message: "Request is not pending" });
    }

    if (action === "reject") {
      user[statusField] = "rejected";
      
      const newNotification = new Notification({
        sender: req.user._id,
        receiver: user._id,
        type: "admin_notice",
        message: `Your points request for adding your ${field} was declined by the Admin.`
      });
      await newNotification.save();

      if (req.io) {
        const senderInfo = { _id: req.user._id, name: req.user.name, profilePicture: req.user.profilePicture };
        const populatedNotification = await Notification.findById(newNotification._id).populate("sender", "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded");
        req.io.to(user._id.toString()).emit("newNotification", { ...populatedNotification.toObject(), sender: senderInfo });
      }

      await user.save();
      return res.json({ message: "Profile points request rejected" });
    }

    if (action === "approve") {
      const pointsToAward = 10;
      
      if (!user.points) user.points = { total: 0 };
      user.points.total = (user.points.total || 0) + pointsToAward;
      user.points.studentEngagement = (user.points.studentEngagement || 0) + pointsToAward;
      user[statusField] = "approved";
      await user.save();

      const newNotification = new Notification({
        sender: req.user._id,
        receiver: user._id,
        type: "points_earned",
        message: `Congratulations! You earned ${pointsToAward} points for adding your ${field}.`
      });
      await newNotification.save();

      if (req.io) {
        const senderInfo = { _id: req.user._id, name: req.user.name, profilePicture: req.user.profilePicture };
        const userRoom = user._id.toString();
        req.io.to(userRoom).emit("newNotification", { ...newNotification.toObject(), sender: senderInfo });
        req.io.to(userRoom).emit("pointsUpdated", {
          totalPoints: user.points.total,
          awardedPoints: pointsToAward,
          category: "studentEngagement",
          reason: `Added ${field}`
        });
      }

      return res.json({ message: "Profile points request approved and awarded" });
    }

    res.status(400).json({ message: "Invalid action" });
  } catch (error) {
    console.error("Profile points approval error:", error);
    res.status(500).json({ message: "Failed to process profile points request" });
  }
};

module.exports = {
  getPendingPointsRequests,
  approvePointsRequest,
  getPendingProfilePointsRequests,
  approveProfilePointsRequest
};
