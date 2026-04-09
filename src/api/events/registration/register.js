const Registration = require("../../../../models/Registration");
const Event = require("../../../../models/Event");

const registerEvent = async (req, res) => {
  try {
    const { eventId, isGroup, groupMembers, answers } = req.body;
    const userId = req.user._id || req.user.id;

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: "Event not found" });

    // Check if registration is still open
    const now = new Date();
    if (now > new Date(event.registrationCloseDate)) {
      return res.status(400).json({ message: "Registration for this event has closed." });
    }

    // Check if already registered - Update instead of reject
    const existingRegistration = await Registration.findOne({ userId, eventId });
    if (existingRegistration) {
      // Validate group registration
      if (isGroup && !event.allowGroupRegistration) {
        return res.status(400).json({ message: "Group registration is not allowed for this event." });
      }

      existingRegistration.isGroup = !!isGroup;
      existingRegistration.groupMembers = isGroup ? groupMembers : [];
      existingRegistration.answers = answers || {};
      await existingRegistration.save();

      // Recalculate true headcount globally
      const allRegs = await Registration.find({ eventId });
      let totalHeadcount = 0;
      allRegs.forEach(reg => {
         totalHeadcount += 1 + (reg.isGroup ? (reg.groupMembers?.length || 0) : 0);
      });

      req.io?.emit("registrationCountUpdated", { 
         postId: eventId, 
         registrationCount: totalHeadcount 
      });

      return res.status(200).json({ message: "Registration updated successfully!", registration: existingRegistration });
    }

    // Validate group registration
    if (isGroup && !event.allowGroupRegistration) {
      return res.status(400).json({ message: "Group registration is not allowed for this event." });
    }

    const registration = new Registration({
      userId,
      eventId,
      isGroup: !!isGroup,
      groupMembers: isGroup ? groupMembers : [],
      answers: answers || {},
    });

    await registration.save();

    // Calculate realistic headcount accurately including group subsets
    const allRegs = await Registration.find({ eventId });
    let totalHeadcount = 0;
    allRegs.forEach(reg => {
       totalHeadcount += 1 + (reg.isGroup ? (reg.groupMembers?.length || 0) : 0);
    });

    // Notify all connected clients dynamically
    req.io?.emit("registrationCountUpdated", { 
       postId: eventId, 
       registrationCount: totalHeadcount 
    });

    res.status(201).json({ message: "Successfully registered for the event!", registration });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Error registering for event" });
  }
};

module.exports = registerEvent;
