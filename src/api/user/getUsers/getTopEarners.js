const User = require("../../../../models/User");

const getTopEarners = async (req, res) => {
  try {
    const topUsers = await User.find({ approved: true, role: "student", "points.total": { $gt: 0 } })
      .sort({ "points.total": -1 })
      .limit(5)
      .select("name publicId points profilePicture profileImageFocus bannerImageFocus role course semester");
    res.json(topUsers);
  } catch (error) {
    console.error("Top earners error:", error);
    res.status(500).json({ message: "Failed to fetch top earners" });
  }
};

module.exports = getTopEarners;
