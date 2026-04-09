const Post = require("../../../models/Post");
const User = require("../../../models/User");
const Notification = require("../../../models/Notification");

const getPendingPointsRequests = async (req, res) => {
  try {
    const posts = await Post.find({
      $or: [
        { pointsRequested: true, pointsStatus: "pending" },
        { "announcementDetails.pointsRequested": true, "announcementDetails.pointsStatus": "pending" }
      ]
    })
    .populate("user", "name profilePicture")
    .populate({ path: "announcementDetails.winners.userId", select: "name profilePicture publicId" })
    .populate({ path: "announcementDetails.winners.groupMembers", select: "name profilePicture" })
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
        message = "Your Alumni Session points request was declined by the Admin.";
      } else if (post.announcementDetails) {
        const eventName = post.announcementDetails.eventName || "an event";
        message = `Your points request for event "${eventName}" was declined by the Admin.`;
        post.announcementDetails.pointsStatus = "rejected";
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
        const populatedNotification = await Notification.findById(newNotification._id).populate("sender", "name profilePicture");
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
              user.points.alumniParticipation = (user.points.alumniParticipation || 0) + pointsToAward;
              await user.save();

              const eventName = post.announcementDetails?.eventName || "an event";
              const rank = winner.rank || "a winner";

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
                  category: "alumniParticipation",
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
    }

    res.status(400).json({ message: "Invalid action" });
  } catch (error) {
    console.error("Points approval error:", error);
    res.status(500).json({ message: "Failed to process points request" });
  }
};

module.exports = {
  getPendingPointsRequests,
  approvePointsRequest
};
