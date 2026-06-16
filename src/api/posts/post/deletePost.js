const Post = require("../../../../models/Post");
const cloudinary = require("../../../../config/cloudinary");

const deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const User = require("../../../../models/User");
    const currentUser = await User.findById(req.user.id);
    const isAdmin = currentUser && currentUser.isMainAdmin;

    if (post.user.toString() !== req.user.id && !isAdmin)
      return res.status(403).json({ message: "Unauthorized" });

    // Handle Admin notification if deleting someone else's post
    if (isAdmin && post.user.toString() !== req.user.id) {
      try {
        const Notification = require("../../../../models/Notification");
        const adminNote = new Notification({
          sender: req.user.id,
          receiver: post.user,
          type: "admin_notice",
          message: `Your ${post.type === "Regular" ? "post" : post.type.toLowerCase()} has been removed by the Admin for violating community guidelines.`,
        });
        await adminNote.save();
        if (req.io) {
          const populatedNotification = await Notification.findById(adminNote._id).populate("sender", "name profilePicture");
          const targetRoom = post.user.toString();
          req.io.to(targetRoom).emit("newNotification", populatedNotification);
          req.io.to(targetRoom).emit("liveNotification", populatedNotification);
        }
      } catch (noteErr) {
        console.error("❌ Failed to send admin deletion notice:", noteErr.message);
      }
    }

    for (const image of post.images || []) {
      if (image.public_id) {
        try {
          await cloudinary.uploader.destroy(image.public_id, { resource_type: "image", invalidate: true });
        } catch (err) {
          console.error("❌ Image delete failed:", err.message);
        }
      }
    }

    if (post.video?.public_id) {
      const fallbackTypes = ["video", "raw", "auto"];
      for (const type of fallbackTypes) {
        try {
          const result = await cloudinary.uploader.destroy(post.video.public_id, {
            resource_type: type,
            invalidate: true
          });
          if (result.result === "ok") break;
        } catch (err) {
          console.error(`❌ Failed deleting video as ${type}:`, err.message);
        }
      }
    }

    for (const doc of post.documents || []) {
      if (doc.public_id) {
        const fallbackTypes = ["raw", "auto", "image"];
        let deleted = false;
        for (const type of fallbackTypes) {
          try {
            const result = await cloudinary.uploader.destroy(doc.public_id, { resource_type: type, invalidate: true });
            if (result.result === "ok" || result.result === "not found") {
              deleted = true;
              break;
            }
            // If raw failed, try removing extension and use image type
            if (type === "raw" && result.result !== "ok") {
              const withoutExt = doc.public_id.substring(0, doc.public_id.lastIndexOf(".")) || doc.public_id;
              const imgResult = await cloudinary.uploader.destroy(withoutExt, { resource_type: "image", invalidate: true });
              if (imgResult.result === "ok") {
                 deleted = true;
                 break;
              }
            }
          } catch (err) {
            console.error(`❌ Document delete failed as ${type}:`, err.message);
          }
        }
        if (!deleted) console.log(`⚠️ Document could not be deleted from Cloudinary: ${doc.public_id}`);
      }
    }

    // Cleanup Notifications for this post
    try {
      const Notification = require("../../../../models/Notification");
      await Notification.deleteMany({ postId: req.params.id });
    } catch (err) {
      console.error("❌ Failed deleting notifications for post:", err.message);
    }

    await Post.findByIdAndDelete(req.params.id);
    req.io.emit("postDeleted", { postId: req.params.id });

    // ✅ Revoke Points
    try {
      const PointsSystemConfig = require("../../../../models/PointsSystemConfig");
      const config = (await PointsSystemConfig.findOne()) || { postPoints: 10 };
      
      const postAuthor = await User.findById(post.user);
      if (postAuthor && postAuthor.points) {
        // Subtract points safely
        postAuthor.points.total = Math.max(0, (postAuthor.points.total || 0) - (config.postPoints || 10));
        
        if (postAuthor.points.contentContribution !== undefined) {
          postAuthor.points.contentContribution = Math.max(0, postAuthor.points.contentContribution - (config.postPoints || 10));
        }

        // Pop last log entry if possible, though not strictly necessary since the point total is what matters
        if (postAuthor.postPointLogs && postAuthor.postPointLogs.length > 0) {
          postAuthor.postPointLogs.pop();
        }

        await postAuthor.save();
        console.log(`✅ Revoked ${config.postPoints} points from user ${postAuthor.name} for post deletion.`);
      }
    } catch (revokeErr) {
      console.error("❌ Failed to revoke points:", revokeErr.message);
    }

    res.json({ message: "Post deleted successfully" });
  } catch (err) {
    console.error("❌ Delete post error:", err);
    res.status(500).json({ message: "Failed to delete post" });
  }
};

module.exports = deletePost;
