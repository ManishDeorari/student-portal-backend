const User = require("../../../../models/User");
const PointsSystemConfig = require("../../../../models/PointsSystemConfig");
const cloudinary = require("../../../../config/cloudinary");

module.exports = async (req, res) => {
  try {
    const { oldImageUrl, profileImage, ...rest } = req.body;

    // 🧹 Delete old Cloudinary image if present & not default
    if (
      oldImageUrl &&
      oldImageUrl.includes("res.cloudinary.com") &&
      !oldImageUrl.includes("default-profile.jpg")
    ) {
      const publicId = extractPublicId(oldImageUrl);
      if (publicId) {
        try {
          await cloudinary.uploader.destroy(publicId);
          console.log(`🗑 Deleted old Cloudinary image: ${publicId}`);
        } catch (err) {
          console.error("❌ Failed to delete old image from Cloudinary:", err);
        }
      }
    }

    // ✅ Update user profile picture in DB only if provided
    const updates = {
      ...rest,
    };
    if (profileImage) {
      updates.profilePicture = profileImage;
    }

    // ✅ Format education entries
    if (updates.education && Array.isArray(updates.education)) {
      updates.education = updates.education.map((edu) => {
        let startYear = null;
        let endYear = null;

        if (edu.startYear) startYear = Number(edu.startYear);
        else if (edu.startDate) startYear = Number(edu.startDate.split(" ").pop());

        if (edu.endYear) endYear = Number(edu.endYear);
        else if (edu.endDate) endYear = Number(edu.endDate.split(" ").pop());

        const formattedCourse = edu.course ? String(edu.course).toUpperCase() : "";
        let courseYearKey = null;
        
        if (formattedCourse && endYear && !isNaN(endYear)) {
          // e.g. MCA_2026
          courseYearKey = `${formattedCourse}_${endYear}`.toUpperCase();
        }

        return {
          ...edu,
          degree: edu.degree,
          course: formattedCourse || edu.course,
          branch: edu.branch || "",
          startYear: isNaN(startYear) ? null : startYear,
          endYear: isNaN(endYear) ? null : endYear,
          courseYearKey
        };
      });
    }

    const updatedUser = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
    }).select("-password");

    // ✅ Award Points Logic (Strict Checklist)
    if (updatedUser.role === "alumni" && !updatedUser.profileCompletionAwarded) {
      const config = await PointsSystemConfig.findOne() || { profileCompletionPoints: 50 };

      const hasProfilePic = updatedUser.profilePicture && !updatedUser.profilePicture.includes("default-profile.jpg");
      const hasBanner = updatedUser.bannerImage && !updatedUser.bannerImage.includes("default_banner.jpg");
      const hasPhone = updatedUser.phone && updatedUser.phone !== "Not provided";
      const hasAddress = updatedUser.address && updatedUser.address !== "Not set";
      const hasWhatsApp = updatedUser.whatsapp && updatedUser.whatsapp !== "Not linked";
      const hasLinkedIn = updatedUser.linkedin && updatedUser.linkedin !== "Not linked";
      const hasBio = updatedUser.bio && updatedUser.bio.trim().length > 0;

      // ✅ Revised Education Logic: Mandatory 4 Levels
      const MANDATORY_DEGREES = [
        "High School (Secondary - Class 10)",
        "Intermediate (Higher Secondary - Class 11-12)",
        "Undergraduate (Bachelor's Degree)",
        "Postgraduate (Master's Degree)"
      ];

      const userEducations = updatedUser.education || [];
      const completedMandatoryCount = MANDATORY_DEGREES.filter(degree => {
        const found = userEducations.find(e => e.level === degree || e.degree === degree);
        return found && found.institution && found.startDate && found.endDate;
      }).length;

      const hasEducation = completedMandatoryCount >= 3;
      const hasExperience = updatedUser.experience && updatedUser.experience.length > 0;

      const hasWorkProfile = updatedUser.workProfile &&
        (updatedUser.workProfile.functionalArea || updatedUser.workProfile.industry);

      const hasJobPreferences = updatedUser.jobPreferences &&
        (updatedUser.jobPreferences.functionalArea || updatedUser.jobPreferences.preferredLocations?.length > 0);

      const isCompleted = hasProfilePic && hasBanner && hasPhone && hasAddress &&
        hasWhatsApp && hasLinkedIn && hasBio && hasEducation;

      if (isCompleted) {
        if (!updatedUser.points) updatedUser.points = { total: 0 };
        const awardAmount = config.profileCompletionPoints || 50;

        updatedUser.points.total = (updatedUser.points.total || 0) + awardAmount;
        updatedUser.points.profileCompletion = (updatedUser.points.profileCompletion || 0) + awardAmount;

        updatedUser.profileCompletionAwarded = true;
        await updatedUser.save();

        // ✅ Notification for points
        try {
          const Notification = require("../../../../models/Notification");
          const newNotification = new Notification({
            sender: updatedUser._id, // User is the sender (UI will handle "System" label)
            receiver: updatedUser._id,
            type: "points_earned",
            message: `You earned ${awardAmount} points by Profile completion.`,
          });
          await newNotification.save();

          if (req.io) {
            const populatedNotification = await Notification.findById(newNotification._id).populate("sender", "name profilePicture");
            req.io.to(updatedUser._id.toString()).emit("newNotification", populatedNotification);
          }
        } catch (noteErr) {
          console.error("❌ Failed to send profile completion award notice:", noteErr.message);
        }

        console.log(`✅ Awarded ${awardAmount} points to user ${updatedUser.name} for FULL profile completion.`);
      }
    }

    res.json(updatedUser);
  } catch (error) {
    console.error("❌ Error updating profile:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// 🔍 More robust extractPublicId
function extractPublicId(imageUrl) {
  try {
    // Remove query params
    imageUrl = imageUrl.split("?")[0];

    // Find the part after /upload/
    const afterUpload = imageUrl.split("/upload/")[1];
    if (!afterUpload) return null;

    // Remove any version number like /v123456/
    const noVersion = afterUpload.replace(/v\d+\//, "");

    // Remove file extension
    return noVersion.substring(0, noVersion.lastIndexOf(".")) || noVersion;
  } catch (e) {
    console.error("⚠️ Failed to extract public_id:", e.message);
    return null;
  }
}