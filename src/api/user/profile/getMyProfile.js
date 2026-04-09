const User = require("../../../../models/User");

module.exports = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) return res.status(404).json({ message: "User not found" });
    
    // ✅ DAILY LOGIN POINTS LOGIC (Alumni Only)
    let loginPointsAwarded = 0;
    if (user.role === "alumni") {
      const today = new Date().setHours(0, 0, 0, 0);
      const lastAwarded = user.lastLoginPointAwardedAt ? new Date(user.lastLoginPointAwardedAt).setHours(0, 0, 0, 0) : null;

      if (!lastAwarded || lastAwarded < today) {
        const pointsToAdd = 10;
        loginPointsAwarded = pointsToAdd;
        
        // Ensure points object exists
        if (!user.points) user.points = { total: 0 };
        
        // Increment login points
        user.points.login = (user.points.login || 0) + pointsToAdd;
        
        // Update total
        user.points.total = Object.keys(user.points.toObject()).reduce((sum, key) => {
          if (["total", "_id", "__v"].includes(key)) return sum;
          return sum + (user.points[key] || 0);
        }, 0);

        user.lastLoginPointAwardedAt = new Date();
        await user.save();

        // Create persistent notification
        try {
          const Notification = require("../../../../models/Notification");
          const newNotification = new Notification({
            sender: user._id,
            receiver: user._id,
            type: "points_earned",
            message: `You earned 10 points for your daily login!`,
          });
          await newNotification.save();

          // Emit live feedback
          if (req.io) {
            const populatedNotification = await Notification.findById(newNotification._id).populate("sender", "name profilePicture");
            const targetRoom = user._id.toString();
            req.io.to(targetRoom).emit("newNotification", populatedNotification);
            req.io.to(targetRoom).emit("liveNotification", populatedNotification);
            req.io.to(targetRoom).emit("pointsUpdated", {
              reason: "Daily Login Reward",
              awardedPoints: pointsToAdd,
              totalPoints: user.points.total
            });
          }
        } catch (noteErr) {
          console.error("❌ Failed to create/emit daily login notification:", noteErr.message);
        }
      }
    }

    // ✅ Return the complete user object (already excluded password in query)
    const userObj = user.toObject();
    if (loginPointsAwarded > 0) {
      userObj.loginPointsAwarded = loginPointsAwarded;
    }
    res.json(userObj);
  } catch (error) {
    console.error("❌ Error fetching user profile:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};
