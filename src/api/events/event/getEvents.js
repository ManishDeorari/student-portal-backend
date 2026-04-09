const Event = require("../../../../models/Event");
const Registration = require("../../../../models/Registration");

const getEvents = async (req, res) => {
  try {
    const events = await Event.find()
      .populate("createdBy", "name profilePicture")
      .populate({ path: "comments.user", select: "name profilePicture" })
      .populate({ path: "comments.replies.user", select: "name profilePicture" })
      .sort({ createdAt: -1 });

    const eventsWithCounts = await Promise.all(events.map(async (event) => {
      const registrationCount = await Registration.countDocuments({ eventId: event._id });
      let isRegistered = false;
      let myRegistration = null;
      if (req.user) {
        const reg = await Registration.findOne({ eventId: event._id, userId: req.user._id });
        if (reg) {
          isRegistered = true;
          myRegistration = reg.toObject({ flattenMaps: true });
        }
      }
      // Use toJSON() to ensure reactions (Maps) are converted to plain objects
      const ev = event.toJSON();
      return { ...ev, content: ev.description, user: ev.createdBy, type: "Event", registrationCount, isRegistered, myRegistration };
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
      .populate("createdBy", "name profilePicture")
      .populate({ path: "comments.user", select: "name profilePicture" })
      .populate({ path: "comments.replies.user", select: "name profilePicture" });
    if (!event) return res.status(404).json({ message: "Event not found" });

    const registrationCount = await Registration.countDocuments({ eventId: event._id });
    
    // Check if the current user is registered
    let isRegistered = false;
    let myRegistration = null;
    if (req.user) {
      const registration = await Registration.findOne({ eventId: event._id, userId: req.user._id || req.user.id });
      if (registration) {
        isRegistered = true;
        myRegistration = registration.toObject ? registration.toObject({ flattenMaps: true }) : registration;
      }
    }

    const ev = event.toJSON();
    res.json({ ...ev, content: ev.description, user: ev.createdBy, type: "Event", registrationCount, isRegistered, myRegistration });
  } catch (error) {
    res.status(500).json({ message: "Error fetching event" });
  }
};

module.exports = { getEvents, getEventById };
