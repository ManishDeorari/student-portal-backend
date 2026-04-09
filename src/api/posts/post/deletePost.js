const Post = require("../../../../models/Post");
const cloudinary = require("cloudinary").v2;

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
          await cloudinary.uploader.destroy(image.public_id, { resource_type: "image" });
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
          });
          if (result.result === "ok") break;
        } catch (err) {
          console.error(`❌ Failed deleting video as ${type}:`, err.message);
        }
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

    res.json({ message: "Post deleted successfully" });
  } catch (err) {
    console.error("❌ Delete post error:", err);
    res.status(500).json({ message: "Failed to delete post" });
  }
};

module.exports = deletePost;
