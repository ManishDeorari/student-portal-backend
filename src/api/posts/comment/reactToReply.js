const Post = require("../../../../models/Post");

const reactToReply = async (req, res) => {
  const { postId, commentId, replyId } = req.params;
  const { emoji } = req.body;
  const userId = req.user._id.toString();

  try {
    const post = await Post.findById(postId).populate({
      path: "comments.user",
      select: "name profilePicture"
    }).populate({
      path: "comments.replies.user",
      select: "name profilePicture"
    });
    if (!post) return res.status(404).json({ msg: "Post not found" });

    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ msg: "Comment not found" });

    const reply = comment.replies.id(replyId);
    if (!reply) return res.status(404).json({ msg: "Reply not found" });

    // Ensure reply.reactions is a Map
    if (!(reply.reactions instanceof Map)) {
      reply.reactions = new Map(Object.entries(reply.reactions || {}));
    }

    let wasInAnyBucket = false;
    let isSameEmoji = false;
    for (const [key, users] of reply.reactions.entries()) {
      const filtered = users.filter((id) => id.toString() !== userId);
      if (filtered.length !== users.length) {
        wasInAnyBucket = true;
        if (key === emoji) isSameEmoji = true;
      }
      reply.reactions.set(key, filtered);
    }

    if (!isSameEmoji) {
      const current = reply.reactions.get(emoji) || [];
      reply.reactions.set(emoji, [...current, userId]);
    }

    post.markModified("comments");
    await post.save();

    const replyOwnerId = reply.user?._id ? reply.user._id.toString() : reply.user.toString();

    // ✅ Award Points Logic (Initial reaction only)
    if (!wasInAnyBucket && !isSameEmoji && req.user.role === "alumni") {
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
            user.points.likes = (user.points.likes || 0) + pts;
            user.points.studentEngagement = (user.points.studentEngagement || 0) + pts;

            // Update logs
            if (!user.likePointLogs) user.likePointLogs = [];
            user.likePointLogs.push(now);

            await user.save();

            const Notification = require("../../../../models/Notification");
            const pointsNotification = new Notification({
              sender: user._id,
              receiver: user._id,
              type: "points_earned",
              message: `You earned ${pts} points by Like.`,
            });
            await pointsNotification.save();

            if (req.io) {
              const populatedNote = await Notification.findById(pointsNotification._id).populate("sender", "name profilePicture");
              const targetRoom = user._id.toString();
              req.io.to(targetRoom).emit("newNotification", populatedNote);
              req.io.to(targetRoom).emit("liveNotification", populatedNote);
            }
            console.log(`✅ Awarded ${pts} points to user ${user.name} for reacting to a reply.`);
        } else {
            console.log(`ℹ️ Like limit reached for user ${user.name}, no points awarded.`);
        }
      } catch (awardErr) {
        console.error("❌ Failed to award points for reply reaction:", awardErr.message);
      }
    }

    // Trigger Notification for the reply owner
    if (!isSameEmoji && replyOwnerId !== userId) {
      const Notification = require("../../../../models/Notification");
      const newNotification = new Notification({
        sender: userId,
        receiver: replyOwnerId,
        type: "reply_reaction",
        message: `${req.user.name} reacted ${emoji} to your reply`,
        postId: postId,
        commentId: commentId,
      });
      await newNotification.save();

      if (req.io) {
        const populatedNotification = await Notification.findById(newNotification._id).populate("sender", "name profilePicture");
        req.io.to(replyOwnerId).emit("newNotification", populatedNotification);
        req.io.to(replyOwnerId).emit("liveNotification", populatedNotification);
      }
    }

    const updatedPost = await Post.findById(postId)
      .populate("user", "name profilePicture")
      .populate({
        path: "comments",
        populate: [
          { path: "user", select: "name profilePicture" },
          { path: "replies.user", select: "name profilePicture" },
        ],
      });

    // Emit updated post and reply reaction info via socket
    req.io.emit("postUpdated", updatedPost);
    req.io.emit("replyReacted", {
      postId,
      commentId,
      replyId,
      emoji,
      userId,
    });

    res.json(updatedPost);
  } catch (err) {
    console.error("❌ React to reply error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

module.exports = reactToReply;
