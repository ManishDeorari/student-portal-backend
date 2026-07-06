const Post = require("../../../../models/Post");
const Event = require("../../../../models/Event");
const Registration = require("../../../../models/Registration");

const getPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const type = req.query.type || "Regular";
    let userId = req.query.userId;
    
    // Resolve publicId to ObjectId if necessary
    if (userId && userId.length !== 24) {
        const User = require("../../../../models/User");
        const userObj = await User.findOne({ publicId: userId });
        if (userObj) {
            userId = userObj._id;
        }
    }
    
    let filter = {};
    // === "ALL" FETCHING LOGIC ===
    if (type === "all" || type === "All") {
      const now = new Date();
      if (userId) filter.user = userId;
      filter.$and = [{ $or: [{ publishAt: { $lte: now } }, { publishAt: { $exists: false } }, { publishAt: null }] }];

      
      const postPopulateOptions = require("../utils/populatePost");
      const posts = await Post.find(filter)
        .select("-announcementDetails.winners -viewedBy")
        .populate(postPopulateOptions);
        
      let eventFilter = userId ? { createdBy: userId } : {};
      const events = await Event.find(eventFilter)
        .populate("createdBy", "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded points.total")
        .populate({ path: "comments.user", select: "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded points.total" })
        .populate({ path: "comments.replies.user", select: "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded points.total" });
        
      const mappedEvents = await Promise.all(events.map(async (e) => {
        const regCount = await Registration.countDocuments({ eventId: e._id });
        const repostCount = await Post.countDocuments({ type: "EventRepost", "eventRepostDetails.originalEventId": e._id });
        let isRegistered = false;
        let myRegistration = null;
        let myRepostId = null;
        if (req.user) {
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
        }
        const ev = e.toObject ? e.toObject({ flattenMaps: true }) : e;
        return { ...ev, content: ev.description, user: ev.createdBy, type: "Event", registrationCount: regCount, repostCount, isRegistered, myRegistration, myRepostId };
      }));
      
      const sortType = req.query.sort || "newest";

      const allContent = [...posts, ...mappedEvents].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        
        if (sortType === "trending") {
          const getScore = (post) => {
             const getReactions = (r, emoji) => r ? (r.get ? r.get(emoji) : r[emoji]) : null;
             const likesArr = getReactions(post.reactions, "👍");
             const likes = likesArr ? likesArr.length : 0;
             const comments = post.comments ? post.comments.length : 0;
             const views = post.viewedBy ? post.viewedBy.length : 0;
             return (likes * 2) + (comments * 3) + (views * 1);
          };
          const scoreA = getScore(a);
          const scoreB = getScore(b);
          if (scoreB !== scoreA) return scoreB - scoreA;
        }

        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      const startIndex = (page - 1) * limit;
      const paginatedContent = allContent.slice(startIndex, startIndex + limit);
      
      return res.json({ posts: paginatedContent, total: allContent.length });
    }

    // === STANDARD FETCHING LOGIC ===
    const { subtype, search } = req.query;

    const now = new Date();
    const publishFilter = { $or: [{ publishAt: { $lte: now } }, { publishAt: { $exists: false } }, { publishAt: null }] };

    if (type === "Regular") {
      filter = { $and: [
        { $or: [{ type: "Regular" }, { type: "EventRepost" }, { type: { $exists: false } }, { type: null }] },
        publishFilter
      ]};
    } else {
      filter = { $and: [{ type }, publishFilter] };
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

    const postPopulateOptions = require("../utils/populatePost");
    const posts = await Post.find(filter)
      .select("-announcementDetails.winners -viewedBy")
      .populate(postPopulateOptions);

    let sortedPosts = posts;
    if (req.query.sort === "trending") {
      sortedPosts = posts.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        const getScore = (p) => {
           const getReactions = (r, emoji) => r ? (r.get ? r.get(emoji) : r[emoji]) : null;
           const likesArr = getReactions(p.reactions, "👍");
           const likes = likesArr ? likesArr.length : 0;
           const comments = p.comments ? p.comments.length : 0;
           const views = p.viewedBy ? p.viewedBy.length : 0;
           return (likes * 2) + (comments * 3) + (views * 1);
        };
        const scoreA = getScore(a);
        const scoreB = getScore(b);
        if (scoreB !== scoreA) return scoreB - scoreA;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
    } else {
      sortedPosts = posts.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
    }

    const paginatedPosts = sortedPosts.slice((page - 1) * limit, page * limit);
    const total = await Post.countDocuments(filter);

    res.json({ posts: paginatedPosts, total });
  } catch (err) {
    console.error("❌ Fetch posts failed:", err);
    res.status(500).json({ message: "Failed to fetch posts" });
  }
};

module.exports = getPosts;
