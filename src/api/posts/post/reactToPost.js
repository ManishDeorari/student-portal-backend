const Post = require("../../../../models/Post");

module.exports = async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id.toString();

    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ error: "Post not found" });

    if (!(post.reactions instanceof Map)) {
      post.reactions = new Map(Object.entries(post.reactions || {}));
    }

    let wasInAnyBucket = false;
    let isSameEmoji = false;
    for (const [key, users] of post.reactions.entries()) {
      const filtered = users.filter(id => id.toString() !== userId);
      if (filtered.length !== users.length) {
        wasInAnyBucket = true;
        if (key === emoji) isSameEmoji = true;
      }
      post.reactions.set(key, filtered);
    }

    if (!isSameEmoji) {
      const current = post.reactions.get(emoji) || [];
      post.reactions.set(emoji, [...current, userId]);
    }

    await post.save();

    const postPopulateOptions = require("../utils/populatePost");

    const updatedPost = await Post.findById(post._id)
      .populate(postPopulateOptions);

    const plainPost = updatedPost.toJSON();

    if (req.io) {
      req.io.emit("postReacted", plainPost);
    }

    // ✅ Award Points Logic (Initial reaction only, to avoid farming on switches)
    if (!wasInAnyBucket && !isSameEmoji && req.user.role === "student") {
      try {
        const User = require("../../../../models/User");
        const PointsSystemConfig = require("../../../../models/PointsSystemConfig");
        const user = await User.findById(userId);
        const config = (await PointsSystemConfig.findOne()) || { 
            likePoints: 2, 
            likeLimitCount: 10, 
            likeLimitDays: 1 
        };

        const now = new Date();
        const limitMs = (config.likeLimitDays || 1) * 24 * 60 * 60 * 1000;
        const recentLogs = (user.likePointLogs || []).filter(date => (now - new Date(date)) < limitMs);

        if (recentLogs.length < (config.likeLimitCount || 10)) {
            if (!user.points) user.points = { total: 0 };
            const pts = config.likePoints || 2;

            user.points.total = (user.points.total || 0) + pts;
            user.points.studentEngagement = (user.points.studentEngagement || 0) + pts;

            // Update logs
            if (!user.likePointLogs) user.likePointLogs = [];
            user.likePointLogs.push(now);

            await user.save();

            // ✅ Notification for points
            try {
              const Notification = require("../../../../models/Notification");
              const newNotification = new Notification({
                sender: user._id,
                receiver: user._id,
                type: "points_earned",
                message: `You earned ${pts} points by Like.`,
              });
              await newNotification.save();

              if (req.io) {
                const populatedNotification = await Notification.findById(newNotification._id).populate("sender", "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded");
                const targetRoom = user._id.toString();
                req.io.to(targetRoom).emit("newNotification", populatedNotification);
                req.io.to(targetRoom).emit("liveNotification", populatedNotification);
              }
            } catch (noteErr) {
              console.error("❌ Failed to send reaction award notice:", noteErr.message);
            }

            console.log(`✅ Awarded ${pts} points to user ${user.name} for reacting.`);
        } else {
            console.log(`ℹ️ Like limit reached for user ${user.name}, no points awarded.`);
        }
      } catch (awardErr) {
        console.error("❌ Failed to award points for reaction:", awardErr.message);
      }
    } else if (isSameEmoji && req.user.role === "student") {
      // ✅ Revoke Points Logic (Reaction Removed)
      try {
        const User = require("../../../../models/User");
        const PointsSystemConfig = require("../../../../models/PointsSystemConfig");
        const user = await User.findById(userId);
        const config = (await PointsSystemConfig.findOne()) || { likePoints: 2 };
        const pts = config.likePoints || 2;

        if (user && user.points) {
          user.points.total = Math.max(0, (user.points.total || 0) - pts);
          user.points.studentEngagement = Math.max(0, (user.points.studentEngagement || 0) - pts);

          if (user.likePointLogs && user.likePointLogs.length > 0) {
            user.likePointLogs.pop();
          }

          await user.save();
          console.log(`✅ Revoked ${pts} points from user ${user.name} for removing reaction.`);

          // ✅ Silent Notification for points deduction
          try {
            const Notification = require("../../../../models/Notification");
            const newNotification = new Notification({
              sender: user._id,
              receiver: user._id,
              type: "silent_points_deducted",
              message: `You lost ${pts} points due to reaction removal.`,
            });
            await newNotification.save();

            if (req.io) {
              const populatedNotification = await Notification.findById(newNotification._id).populate("sender", "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded");
              const targetRoom = user._id.toString();
              req.io.to(targetRoom).emit("newNotification", populatedNotification);
              req.io.to(targetRoom).emit("pointsUpdated", {
                awardedPoints: -pts,
                reason: "Reaction Removal",
                totalPoints: user.points.total
              });
            }
          } catch (noteErr) {
            console.error("❌ Failed to send points deduction notice:", noteErr.message);
          }
        }
      } catch (revokeErr) {
        console.error("❌ Failed to revoke points for reaction removal:", revokeErr.message);
      }
    }

    // Trigger Notification for the post owner (Only if it's NOT a toggle off AND not the owner)
    if (!isSameEmoji && userId !== updatedPost.user._id.toString()) {
      const Notification = require("../../../../models/Notification");
      const newNotification = new Notification({
        sender: userId,
        receiver: updatedPost.user._id,
        type: "post_like",
        message: `${req.user.name} reacted with ${emoji} to your ${updatedPost.type === "Regular" ? "post" : updatedPost.type.toLowerCase()}`,
        postId: id,
      });
      await newNotification.save();

      if (req.io) {
        const populatedNotification = await Notification.findById(newNotification._id).populate("sender", "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded");
        const targetOwnerRoom = updatedPost.user._id.toString();
        req.io.to(targetOwnerRoom).emit("newNotification", populatedNotification);
        req.io.to(targetOwnerRoom).emit("liveNotification", populatedNotification);
      }
    }
    res.status(200).json(plainPost);
  } catch (error) {
    console.error("🔥 Reaction error:", error.message);
    res.status(500).json({ error: "Server error" });
  }
};
