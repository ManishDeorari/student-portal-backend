const Event = require("../../../../models/Event");

const createEvent = async (req, res) => {
  try {
    const {
      title,
      description,
      images,
      video,
      startDate,
      startTime,
      timezone,
      endDate,
      registrationCloseDate,
      registrationFields,
      customQuestions,
      allowGroupRegistration,
      showRegistrationInsights
    } = req.body;

    const userRole = req.user.role;
    const isAdmin = req.user.isAdmin;

    // Allow Admin or Faculty to create events
    if (!isAdmin && userRole !== "admin" && userRole !== "faculty") {
      return res.status(403).json({ message: "Only administrators and faculty can create events." });
    }

    if (!title || !description || !startDate || !startTime || !endDate || !registrationCloseDate) {
      return res.status(400).json({ message: "Missing required event fields." });
    }

    const event = new Event({
      title,
      description,
      images: images || [],
      video: video || null,
      startDate,
      startTime,
      timezone: timezone || "IST",
      endDate,
      registrationCloseDate,
      createdBy: req.user._id || req.user.id,
      registrationFields: registrationFields || {
        name: true,
        profileLink: true,
        enrollmentNumber: true,
        email: true,
        phoneNumber: true,
        course: true,
        courseYear: true,
        branchName: true,
        currentCompany: true,
        currentCity: true,
      },
      customQuestions: customQuestions || [],
      allowGroupRegistration: allowGroupRegistration !== undefined ? allowGroupRegistration : true,
      showRegistrationInsights: showRegistrationInsights !== undefined ? showRegistrationInsights : true,
    });

    await event.save();
    const populated = await event.populate("createdBy", "name profilePicture");
    
    const ev = populated.toObject();
    const eventResp = { ...ev, user: ev.createdBy, type: "Event", content: ev.description };

    // Notify via socket for feed update
    req.io?.emit("postCreated", eventResp);

    // ✅ NEW: Broadcast persistent notification to all Staff (Admin/Faculty)
    const { notifyStaff } = require("../../../../utils/notificationHelper");
    const creatorName = populated.createdBy?.name || "A user";
    await notifyStaff(
      req.io,
      req.user._id || req.user.id,
      "admin_notice",
      `${creatorName} created a new Event: "${event.title}"`,
      { postId: event._id }
    );

    res.status(201).json({ event: eventResp });
  } catch (err) {
    console.error("❌ Event creation failed:", err);
    res.status(500).json({ message: "Failed to create event" });
  }
};

module.exports = createEvent;
