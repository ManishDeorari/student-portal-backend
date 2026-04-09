const User = require("../../../../models/User");
const cloudinary = require("../../../../config/cloudinary");

module.exports = async (req, res) => {
  try {
    const { oldImageUrl, bannerImage, ...rest } = req.body;

    // 🧹 Delete old Cloudinary image if present & not default
    if (
      oldImageUrl &&
      oldImageUrl.includes("res.cloudinary.com") &&
      !oldImageUrl.includes("default-banner.jpg") // use default banner filename
    ) {
      const publicId = extractPublicId(oldImageUrl);
      if (publicId) {
        try {
          await cloudinary.uploader.destroy(publicId);
          console.log(`🗑 Deleted old Cloudinary banner: ${publicId}`);
        } catch (err) {
          console.error("❌ Failed to delete old banner from Cloudinary:", err);
        }
      }
    }

    // ✅ Update user banner in DB
    const updates = {
      ...rest,
      bannerImage: bannerImage,
    };

    const updatedUser = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
    }).select("-password");

    res.json(updatedUser);
  } catch (error) {
    console.error("❌ Error updating banner:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// 🔍 More robust extractPublicId
function extractPublicId(imageUrl) {
  try {
    imageUrl = imageUrl.split("?")[0];
    const afterUpload = imageUrl.split("/upload/")[1];
    if (!afterUpload) return null;
    const noVersion = afterUpload.replace(/v\d+\//, "");
    return noVersion.substring(0, noVersion.lastIndexOf(".")) || noVersion;
  } catch (e) {
    console.error("⚠️ Failed to extract public_id:", e.message);
    return null;
  }
}
