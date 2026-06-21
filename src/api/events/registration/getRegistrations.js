const Registration = require("../../../../models/Registration");

const getRegistrations = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    // Only admin and faculty can view all registrations
    if (!req.user.isAdmin && req.user.role !== 'faculty') {
      return res.status(403).json({ message: "Not authorized to view registrations" });
    }

    const registrations = await Registration.find({ eventId })
      .populate("userId", "name email profilePicture profileImageFocus bannerImageFocus enrollmentNumber")
      .sort({ createdAt: 1 });

    const totalCount = registrations.length;
    
    // Add stable group tracking labels if missing
    const processedRegistrations = registrations.map((reg, idx) => {
      const obj = reg.toObject({ flattenMaps: true });
      if (obj.isGroup) {
         obj.groupName = obj.groupName || `Group ${idx + 1}`;
      }
      return obj;
    });

    res.json({ totalCount, registrations: processedRegistrations });
  } catch (error) {
    console.error("Get registrations error:", error);
    res.status(500).json({ message: "Error fetching registrations" });
  }
};

module.exports = getRegistrations;
