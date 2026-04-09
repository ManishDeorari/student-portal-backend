const Event = require("../../../../models/Event");
const Registration = require("../../../../models/Registration");

const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    // Only admin or the creator can delete
    if (!req.user.isAdmin && event.createdBy.toString() !== (req.user._id || req.user.id).toString()) {
      return res.status(403).json({ message: "Not authorized to delete this event" });
    }

    // Cleanup 1: Delete images from Cloudinary
    const cloudinary = require("cloudinary").v2;
    for (const image of event.images || []) {
      if (image.public_id) {
        try {
          await cloudinary.uploader.destroy(image.public_id, { resource_type: "image" });
        } catch (err) {
          console.error("❌ Image delete failed:", err.message);
        }
      }
    }

    // Cleanup 2: Delete video from Cloudinary
    if (event.video?.public_id) {
      const fallbackTypes = ["video", "raw", "auto"];
      for (const type of fallbackTypes) {
        try {
          const result = await cloudinary.uploader.destroy(event.video.public_id, {
            resource_type: type,
          });
          if (result.result === "ok") break;
        } catch (err) {
          console.error(`❌ Failed deleting video as ${type}:`, err.message);
        }
      }
    }

    // Cleanup 3: Delete related Notifications
    try {
      const Notification = require("../../../../models/Notification");
      await Notification.deleteMany({ postId: event._id });
    } catch (err) {
      console.error("❌ Failed deleting notifications:", err.message);
    }

    // Cleanup 4: Delete all registrations associated with this event
    await Registration.deleteMany({ eventId: event._id });
    
    // Cleanup 5: Delete the event itself
    await Event.findByIdAndDelete(req.params.id);

    if (req.io) {
      req.io.emit("postDeleted", { postId: req.params.id });
    }

    res.json({ message: "Event and associated registrations deleted successfully" });
  } catch (error) {
    console.error("Delete event error:", error);
    res.status(500).json({ message: "Error deleting event" });
  }
};

module.exports = deleteEvent;
