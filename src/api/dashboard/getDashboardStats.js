const User = require("../../../models/User");
const Post = require("../../../models/Post");
const Group = require("../../../models/Group");

const getDashboardStats = async (req, res) => {
  try {
    const user = req.user;
    
    // 1. Community Stats (For ALL Users)
    const totalUsers = await User.countDocuments();
    
    // Fetch 5 random active user profile pictures
    const randomUsers = await User.aggregate([
      { $match: { profilePicture: { $exists: true, $ne: "" }, approved: true } },
      { $sample: { size: 5 } },
      { $project: { profilePicture: 1 } }
    ]);
    const randomAvatars = randomUsers.map(u => u.profilePicture);

    const communityStats = {
      totalUsers,
      randomAvatars
    };

    // 2. Admin Real-Time Metrics
    if (user.role === "admin" || user.isMainAdmin) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Logins today: Approximated by users whose visitStats.lastResetTodayVisitsAt is >= start of today
      const loginsToday = await User.countDocuments({
        "visitStats.lastResetTodayVisitsAt": { $gte: today }
      });

      // Currently active: Approximated by users whose lastSeenPostsAt is within the last 30 minutes
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60000);
      const currentlyActive = await User.countDocuments({
        lastSeenPostsAt: { $gte: thirtyMinutesAgo }
      });

      // Posts today
      const postsToday = await Post.countDocuments({
        createdAt: { $gte: today }
      });

      // Points Given Today: For student portal we can query User logs or just use a placeholder if complex
      // Since `postPointLogs` array exists on User, we could aggregate, but it's simpler to just
      // aggregate the `pointsRequested` posts approved today, or sum up points.
      // We will approximate it by posts created today that award points (for now).
      const pointsPostsToday = await Post.find({
        createdAt: { $gte: today },
        $or: [
          { pointsStatus: "approved" },
          { "announcementDetails.pointsStatus": "approved" },
          { "eventRepostDetails.pointsStatus": "approved" }
        ]
      }).select("pointsStatus pointsRequested announcementDetails.pointsStatus announcementDetails.winners eventRepostDetails.pointsStatus type");
      let pointsGivenToday = 0;
      for (const p of pointsPostsToday) {
         if (p.pointsStatus === "approved" && p.pointsRequested) pointsGivenToday += 5; // standard post
         if (p.eventRepostDetails?.pointsStatus === "approved") pointsGivenToday += 10;
         if (p.announcementDetails?.pointsStatus === "approved" && p.announcementDetails.winners) {
            for (const w of p.announcementDetails.winners) {
               pointsGivenToday += Number(w.points) || 0;
            }
         }
      }

      return res.json({
        communityStats,
        adminStats: {
          loginsToday,
          currentlyActive,
          postsToday,
          pointsGivenToday
        }
      });
    }

    // For regular users, only return community stats
    return res.json({ communityStats });
    
  } catch (error) {
    console.error("❌ Error fetching dashboard stats:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

module.exports = getDashboardStats;
