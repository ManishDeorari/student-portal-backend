const Post = require("../../../../models/Post");

const getEventReposts = async (req, res) => {
  try {
    const { id } = req.params;

    // Ensure only admins/faculty can view reposts
    if (req.user.role !== "admin" && req.user.role !== "faculty") {
      return res.status(403).json({ message: "Not authorized to view reposts." });
    }

    const reposts = await Post.find({
      type: "EventRepost",
      "eventRepostDetails.originalEventId": id
    }).populate("user", "name profilePicture enrollmentNumber branch semester course");

    // Format to match the registrations response structure for easy frontend handling
    res.json({
      totalCount: reposts.length,
      reposts: reposts.map(r => ({
        _id: r._id,
        user: r.user,
        createdAt: r.createdAt,
        content: r.content
      }))
    });
  } catch (err) {
    console.error("❌ Failed to fetch event reposts:", err);
    res.status(500).json({ message: "Failed to fetch event reposts" });
  }
};

module.exports = getEventReposts;
