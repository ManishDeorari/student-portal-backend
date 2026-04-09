const User = require("../../../../models/User");

module.exports = async (req, res) => {
  try {
    const { amount, category = "total" } = req.body;

    if (typeof amount !== "number") {
      return res.status(400).json({ message: "Invalid 'amount' in request body" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.points) user.points = {};
    if (!user.points[category]) user.points[category] = 0;

    user.points[category] += amount;

    if (category !== "total") {
      user.points.total = Object.keys(user.points).reduce((sum, key) => {
        return key === "total" ? sum : sum + (user.points[key] || 0);
      }, 0);
    }

    await user.save();

    res.json({ message: "Points updated", points: user.points });
  } catch (error) {
    console.error("❌ Error in PATCH /points/add:", error.message);
    res.status(500).json({ message: "Server error while updating points" });
  }
};
