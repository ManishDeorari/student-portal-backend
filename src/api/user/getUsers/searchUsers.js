const User = require("../../../../models/User");

module.exports = async (req, res) => {
  try {
    const { q, role } = req.query;
    if (!q) {
      return res.json([]);
    }

    // Base filter with search query
    const filter = {
      $or: [
        { name: { $regex: q, $options: "i" } },
        { publicId: { $regex: q, $options: "i" } },
        { enrollmentNumber: { $regex: q, $options: "i" } },
        { employeeId: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } }
      ]
    };

    // Apply role filter if provided
    if (role) {
      filter.role = role;
    }

    // Only return approved users
    filter.approved = true;

    const users = await User.find(filter)
    .select("name publicId enrollmentNumber profilePicture profileImageFocus bannerImageFocus role course semester branch")
    .limit(10);

    res.json(users);
  } catch (error) {
    console.error("❌ Error searching users:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};
