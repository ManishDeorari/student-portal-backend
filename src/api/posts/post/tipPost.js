const Post = require("../../../../models/Post");
const User = require("../../../../models/User");
const Notification = require("../../../../models/Notification");

const tipPost = async (req, res) => {
  try {
    const postId = req.params.id;
    const { amount } = req.body;
    const tipperId = req.user._id;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid tip amount" });
    }

    const post = await Post.findById(postId).populate("user", "name _id");
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (post.user._id.toString() === tipperId.toString()) {
      return res.status(400).json({ message: "You cannot tip your own post" });
    }

    const tipper = await User.findById(tipperId);
    const receiver = await User.findById(post.user._id);

    if (!tipper || !receiver) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if tipper has enough points
    const currentPoints = tipper.points?.total || 0;
    if (currentPoints < amount) {
      return res.status(400).json({ message: "Insufficient points" });
    }

    // Deduct points from tipper
    tipper.points.total -= amount;
    await tipper.save();

    // Add points to receiver
    if (!receiver.points) receiver.points = { total: 0 };
    receiver.points.total = (receiver.points.total || 0) + amount;
    
    // Add to specific category if we have one for tips, else just total
    // receiver.points.contentContribution = (receiver.points.contentContribution || 0) + amount;
    
    await receiver.save();

    // Create Notification
    const newNotification = new Notification({
      sender: tipperId,
      receiver: receiver._id,
      type: "points_earned",
      message: `${tipper.name} tipped you ${amount} points for your post!`,
      postId: post._id,
    });
    await newNotification.save();

    // Emit live notification if possible
    if (req.io) {
      const populatedNotification = await Notification.findById(newNotification._id).populate("sender", "name profilePicture profileCompletionAwarded");
      const targetRoom = receiver._id.toString();
      req.io.to(targetRoom).emit("newNotification", populatedNotification);
      req.io.to(targetRoom).emit("liveNotification", populatedNotification);
    }

    res.status(200).json({ 
      message: "Tip sent successfully", 
      newTotal: tipper.points.total 
    });
  } catch (error) {
    console.error("tipPost error:", error.message);
    res.status(500).json({ message: "Failed to send tip" });
  }
};

module.exports = tipPost;
