const Post = require("../../../../models/Post");

const commentPost = async (req, res) => {
  try {
    const postId = req.params.id;
    const { text } = req.body;
    const userId = req.user._id;

    const comment = {
      user: userId,
      text,
      createdAt: new Date(),
    };

    // Add comment to post
    const post = await Post.findById(postId);
    post.comments.push(comment);
    await post.save();

    // Repopulate with full user details
    const updatedPost = await Post.findById(postId)
      .populate("user", "name profilePicture")
      .populate("comments.user", "name profilePicture")
      .populate("comments.replies.user", "name profilePicture");

    // Emit socket update
    req.io.emit("postUpdated", updatedPost);

    // Trigger Notification if the commenter is not the post owner
    if (userId.toString() !== updatedPost.user._id.toString()) {
      const Notification = require("../../../../models/Notification");
      const newNotification = new Notification({
        sender: userId,
        receiver: updatedPost.user._id,
        type: "post_comment",
        message: `${req.user.name} commented on your ${updatedPost.type === "Regular" ? "post" : updatedPost.type.toLowerCase()}: "${text.substring(0, 20)}${text.length > 20 ? "..." : ""}"`,
        postId: postId,
      });
      await newNotification.save();

      if (req.io) {
        const populatedNotification = await Notification.findById(newNotification._id).populate("sender", "name profilePicture");
        const targetOwnerRoom = updatedPost.user._id.toString();
        req.io.to(targetOwnerRoom).emit("newNotification", populatedNotification);
        req.io.to(targetOwnerRoom).emit("liveNotification", populatedNotification);
      }
    }

    // ✅ Award Points Logic (using User model and PointsSystemConfig)
    if (req.user.role === "alumni") {
      try {
        const User = require("../../../../models/User");
        const PointsSystemConfig = require("../../../../models/PointsSystemConfig");
        const user = await User.findById(userId);
        const config = (await PointsSystemConfig.findOne()) || { 
            commentPoints: 3, 
            commentLimitCount: 5, 
            commentLimitDays: 1 
        };

        const now = new Date();
        const limitMs = (config.commentLimitDays || 1) * 24 * 60 * 60 * 1000;
        const recentLogs = (user.commentPointLogs || []).filter(date => (now - new Date(date)) < limitMs);

        if (recentLogs.length < (config.commentLimitCount || 5)) {
            if (!user.points) user.points = { total: 0 };
            const pts = config.commentPoints || 3;

            user.points.total = (user.points.total || 0) + pts;
            user.points.comments = (user.points.comments || 0) + pts;
            user.points.contentContribution = (user.points.contentContribution || 0) + pts;

            // Update logs
            if (!user.commentPointLogs) user.commentPointLogs = [];
            user.commentPointLogs.push(now);

            await user.save();

            // ✅ Notification for points
            try {
              const Notification = require("../../../../models/Notification");
              const newNotification = new Notification({
                sender: user._id,
                receiver: user._id,
                type: "points_earned",
                message: `You earned ${pts} points by Comment.`,
              });
              await newNotification.save();

              if (req.io) {
                const populatedNotification = await Notification.findById(newNotification._id).populate("sender", "name profilePicture");
                const targetRoom = user._id.toString();
                req.io.to(targetRoom).emit("newNotification", populatedNotification);
                req.io.to(targetRoom).emit("liveNotification", populatedNotification);
              }
            } catch (noteErr) {
              console.error("❌ Failed to send comment award notice:", noteErr.message);
            }

            console.log(`✅ Awarded ${pts} points to user ${user.name} for commenting.`);
        } else {
            console.log(`ℹ️ Comment limit reached for user ${user.name}, no points awarded.`);
        }
      } catch (awardErr) {
        console.error("❌ Failed to award points for comment:", awardErr.message);
      }
    }

    // Return full updated post (✅ Only one response!)
    res.status(201).json(updatedPost);
  } catch (error) {
    console.error("Comment error:", error.message);
    res.status(500).json({ message: "Failed to comment" });
  }
};

module.exports = commentPost;
