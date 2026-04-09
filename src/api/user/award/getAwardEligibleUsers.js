const User = require("../../../../models/User");

module.exports = async (req, res) => {
  try {
    const eligibleUsers = await User.find({ "points.total": { $gte: 80 } })
      .select("-password")
      .sort({ "points.total": -1 });

    res.json(eligibleUsers);
  } catch (error) {
    res.status(500).json({ message: "Error fetching eligible users" });
  }
};
