// controllers/user/getMyPosts.js
const Post = require("../../../../models/Post");
const Event = require("../../../../models/Event");
const Registration = require("../../../../models/Registration");
const postPopulateOptions = require("../../posts/utils/populatePost");

const getMyPosts = async (req, res) => {
  try {
    const userId = req.user.id; // comes from auth middleware

    const posts = await Post.find({ user: userId })
      .populate(postPopulateOptions);

    const events = await Event.find({ createdBy: userId })
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

    res.json(allContent);
  } catch (err) {
    console.error("❌ Fetch my posts failed:", err);
    res.status(500).json({ message: "Failed to fetch user posts" });
  }
};

module.exports = getMyPosts;
