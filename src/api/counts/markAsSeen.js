const User = require("../../../models/User");

const markAsSeen = async (req, res) => {
  try {
    const { section } = req.params;
    const userId = req.user.id;

    let updateField = "";
    switch (section) {
      case "posts":
      case "home":
        updateField = "lastSeenPostsAt";
        break;
      case "groups":
        updateField = "lastSeenGroupsAt";
        break;
      case "network":
        updateField = "lastSeenNetworkAt";
        break;
      case "admin-requests":
        updateField = "lastSeenAdminRequestsAt"; // Need to add this to User model too
        break;
      default:
        return res.status(400).json({ message: "Invalid section" });
    }

    await User.findByIdAndUpdate(userId, {
      [updateField]: new Date()
    });

    res.json({ message: `Section ${section} marked as seen` });
  } catch (err) {
    console.error("Error marking section as seen:", err);
    res.status(500).json({ message: "Server error marking as seen" });
  }
};

module.exports = markAsSeen;
