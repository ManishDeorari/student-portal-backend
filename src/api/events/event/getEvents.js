const Event = require("../../../../models/Event");
const Registration = require("../../../../models/Registration");

const getEvents = async (req, res) => {
  try {
    const events = await Event.find()
      .populate("createdBy", "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded")
      .populate({ path: "comments.user", select: "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded" })
      .populate({ path: "comments.replies.user", select: "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded" })
      .sort({ createdAt: -1 });

    const eventsWithCounts = await Promise.all(events.map(async (event) => {
      const registrationCount = await Registration.countDocuments({ eventId: event._id });
      const repostCount = await Post.countDocuments({ type: "EventRepost", "eventRepostDetails.originalEventId": event._id });
      let isRegistered = false;
      let myRegistration = null;
      let myRepostId = null;
      if (req.user) {
        const reqUserId = req.user._id || req.user.id;
        const reg = await Registration.findOne({ eventId: event._id, userId: reqUserId });
        if (reg) {
          isRegistered = true;
          myRegistration = reg.toObject({ flattenMaps: true });
        }
        const repost = await Post.findOne({ type: "EventRepost", "eventRepostDetails.originalEventId": event._id, user: reqUserId }).select("_id");
        if (repost) {
          myRepostId = repost._id.toString();
        }
      }
      // Use toJSON() to ensure reactions (Maps) are converted to plain objects
      const ev = event.toJSON();
      return { ...ev, content: ev.description, user: ev.createdBy, type: "Event", registrationCount, repostCount, isRegistered, myRegistration, myRepostId };
    }));

    res.json({ posts: eventsWithCounts });
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).json({ message: "Error fetching events" });
  }
};

const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate("createdBy", "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded")
      .populate({ path: "comments.user", select: "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded" })
      .populate({ path: "comments.replies.user", select: "name profilePicture profileImageFocus bannerImageFocus profileCompletionAwarded" });
    if (!event) return res.status(404).json({ message: "Event not found" });

    const registrationCount = await Registration.countDocuments({ eventId: event._id });
    const repostCount = await Post.countDocuments({ type: "EventRepost", "eventRepostDetails.originalEventId": event._id });
    
    // Check if the current user is registered or has reposted
    let isRegistered = false;
    let myRegistration = null;
    let myRepostId = null;
    if (req.user) {
      const reqUserId = req.user._id || req.user.id;
      const registration = await Registration.findOne({ eventId: event._id, userId: reqUserId });
      if (registration) {
        isRegistered = true;
        myRegistration = registration.toObject ? registration.toObject({ flattenMaps: true }) : registration;
      }
      const repost = await Post.findOne({ type: "EventRepost", "eventRepostDetails.originalEventId": event._id, user: reqUserId }).select("_id");
      if (repost) {
        myRepostId = repost._id.toString();
      }
    }

    const ev = event.toJSON();
    res.json({ ...ev, content: ev.description, user: ev.createdBy, type: "Event", registrationCount, repostCount, isRegistered, myRegistration, myRepostId });
  } catch (error) {
    res.status(500).json({ message: "Error fetching event" });
  }
};

module.exports = { getEvents, getEventById };
