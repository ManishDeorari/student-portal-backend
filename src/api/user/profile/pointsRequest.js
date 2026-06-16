const User = require("../../../../models/User");
const Notification = require("../../../../models/Notification");

const profilePointsRequest = async (req, res) => {
  try {
    const { field } = req.body; // 'resume', 'github', or 'portfolio'

    if (!["resume", "github", "portfolio"].includes(field)) {
      return res.status(400).json({ message: "Invalid field for points request" });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const statusField = `${field}PointsStatus`;

    if (user[statusField] === "pending" || user[statusField] === "approved") {
      return res.status(400).json({ message: "Points already requested or approved for this field." });
    }

    if (!user[field]) {
      return res.status(400).json({ message: `Please fill out your ${field} before requesting points.` });
    }

    user[statusField] = "pending";
    await user.save();

    res.json({ message: "Points request submitted successfully", user });
  } catch (error) {
    console.error("Error submitting profile points request:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = profilePointsRequest;
