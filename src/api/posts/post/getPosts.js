const Post = require("../../../../models/Post");
const Event = require("../../../../models/Event");
const Registration = require("../../../../models/Registration");

const getPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const type = req.query.type || "Regular";
    const userId = req.query.userId;
    
    // === "ALL" FETCHING LOGIC ===
    if (type === "all" || type === "All") {
      let filter = {};
      if (userId) filter.user = userId;
      
      const posts = await Post.find(filter)
        .populate("user", "name profilePicture")
        .populate({ path: "comments.user", select: "name profilePicture" })
        .populate({ path: "comments.replies.user", select: "name profilePicture" })
        .populate({ path: "announcementDetails.winners.userId", select: "name profilePicture publicId" })
        .populate({ path: "announcementDetails.winners.groupMembers", select: "name profilePicture" });
        
      let eventFilter = userId ? { createdBy: userId } : {};
      const events = await Event.find(eventFilter)
        .populate("createdBy", "name profilePicture")
        .populate({ path: "comments.user", select: "name profilePicture" })
        .populate({ path: "comments.replies.user", select: "name profilePicture" });
        
      const mappedEvents = await Promise.all(events.map(async (e) => {
        const regCount = await Registration.countDocuments({ eventId: e._id });
        let isRegistered = false;
        let myRegistration = null;
        if (req.user) {
          const reqUserId = req.user._id || req.user.id;
          const reg = await Registration.findOne({ eventId: e._id, userId: reqUserId });
          if (reg) {
            isRegistered = true;
            myRegistration = reg.toObject({ flattenMaps: true });
          }
        }
        const ev = e.toObject ? e.toObject({ flattenMaps: true }) : e;
        return { ...ev, content: ev.description, user: ev.createdBy, type: "Event", registrationCount: regCount, isRegistered, myRegistration };
      }));
      
      const allContent = [...posts, ...mappedEvents].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const startIndex = (page - 1) * limit;
      const paginatedContent = allContent.slice(startIndex, startIndex + limit);
      
      return res.json({ posts: paginatedContent, total: allContent.length });
    }

    // === STANDARD FETCHING LOGIC ===
    let filter = {};
    const { subtype, search } = req.query;

    if (type === "Regular") {
      filter = { $or: [{ type: "Regular" }, { type: { $exists: false } }, { type: null }] };
    } else {
      filter = { type };
    }

    if (type === "Announcement") {
      if (subtype === "winner") {
        filter["announcementDetails.isWinnerAnnouncement"] = true;
      }
      if (search) {
        filter["$or"] = [
          { content: { $regex: search, $options: "i" } },
          { "announcementDetails.winners.name": { $regex: search, $options: "i" } }
        ];
      }
    }

    if (userId) filter.user = userId;

    const posts = await Post.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("user", "name profilePicture")
      .populate({ path: "comments.user", select: "name profilePicture" })
      .populate({ path: "comments.replies.user", select: "name profilePicture" })
      .populate({ path: "announcementDetails.winners.userId", select: "name profilePicture publicId" })
      .populate({ path: "announcementDetails.winners.groupMembers", select: "name profilePicture" });

    const total = await Post.countDocuments(filter);

    res.json({ posts, total });
  } catch (err) {
    console.error("❌ Fetch posts failed:", err);
    res.status(500).json({ message: "Failed to fetch posts" });
  }
};

module.exports = getPosts;
