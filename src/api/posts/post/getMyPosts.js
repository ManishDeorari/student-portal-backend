const Post = require("../../../../models/Post");
const Event = require("../../../../models/Event");
const Registration = require("../../../../models/Registration");

const getMyPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const postPopulateOptions = require("../utils/populatePost");

    const posts = await Post.find({ user: req.user._id })
      .populate(postPopulateOptions);

    const events = await Event.find({ createdBy: req.user._id })
      .populate("createdBy", "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded points.total")
      .populate({ path: "comments.user", select: "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded points.total" })
      .populate({ path: "comments.replies.user", select: "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded points.total" });

    const mappedEvents = await Promise.all(events.map(async (e) => {
      const regCount = await Registration.countDocuments({ eventId: e._id });
      const repostCount = await Post.countDocuments({ type: "EventRepost", "eventRepostDetails.originalEventId": e._id });
      let isRegistered = false;
      let myRegistration = null;
      let myRepostId = null;
      
      const reqUserId = req.user._id || req.user.id;
      const reg = await Registration.findOne({ eventId: e._id, userId: reqUserId });
      if (reg) {
        isRegistered = true;
        myRegistration = reg.toObject({ flattenMaps: true });
      }
      const repost = await Post.findOne({ type: "EventRepost", "eventRepostDetails.originalEventId": e._id, user: reqUserId }).select("_id");
      if (repost) {
        myRepostId = repost._id.toString();
      }
      
      const ev = e.toObject ? e.toObject({ flattenMaps: true }) : e;
      return { ...ev, content: ev.description, user: ev.createdBy, type: "Event", registrationCount: regCount, repostCount, isRegistered, myRegistration, myRepostId };
    }));

    const allContent = [...posts, ...mappedEvents].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    const paginatedContent = allContent.slice((page - 1) * limit, page * limit);
    const total = allContent.length;

    res.json({ posts: paginatedContent, total });
  } catch (err) {
    console.error("❌ Fetch my posts failed:", err);
    res.status(500).json({ message: "Failed to fetch my posts" });
  }
};

module.exports = getMyPosts;
