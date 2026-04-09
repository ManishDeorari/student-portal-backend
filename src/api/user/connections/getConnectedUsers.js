const User = require("../../../../models/User");

module.exports = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate("connections", "-password");
    res.json(user.connections || []);
  } catch (error) {
    console.error("❌ Error fetching connections:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};
