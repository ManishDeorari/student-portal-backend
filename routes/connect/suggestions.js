// routes/connect/suggestions.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middleware/authMiddleware");
const User = require("../../models/User");

router.get("/", authMiddleware, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);
    if (!currentUser) return res.status(404).json({ message: "User not found" });

    // Exclude self, already connected, and already requested
    const excludeIds = [
      req.user._id.toString(),
      ...(currentUser.connections || []).map(id => id.toString()),
      ...(currentUser.sentRequests || []).map(id => id.toString()),
      ...(currentUser.pendingRequests || []).map(id => id.toString())
    ];

    // 1. Random Recommendations (Alumni only)
    const randomRecommendations = await User.aggregate([
      {
        $match: {
          _id: { $nin: excludeIds.map(id => new (require("mongoose")).Types.ObjectId(id)) },
          role: "alumni",
          approved: true
        }
      },
      { $sample: { size: 6 } },
      {
        $project: {
          name: 1, course: 1, profilePicture: 1, enrollmentNumber: 1, workProfile: 1, skills: 1
        }
      }
    ]);

    // 2. Faculty and Admin (Influence section replacement)
    const facultyAndAdmin = await User.aggregate([
      {
        $match: {
          _id: { $nin: excludeIds.map(id => new (require("mongoose")).Types.ObjectId(id)) },
          role: { $in: ["faculty", "admin"] },
          approved: true
        }
      },
      { $sample: { size: 6 } },
      {
        $project: {
          name: 1, role: 1, profilePicture: 1, employeeId: 1, bio: 1
        }
      }
    ]);

    // 3. Related People (Same course or industry)
    const relatedPeople = await User.find({
      _id: { $nin: [...excludeIds, ...randomRecommendations.map(u => u._id.toString()), ...facultyAndAdmin.map(u => u._id.toString())] },
      role: "alumni",
      approved: true,
      $or: [
        { course: currentUser.course },
        { "workProfile.industry": currentUser.workProfile?.industry }
      ]
    })
      .select("name course profilePicture enrollmentNumber workProfile skills")
      .limit(6);

    res.json({
      randomRecommendations,
      facultyAndAdmin,
      relatedPeople
    });
  } catch (err) {
    console.error("❌ Suggestions Error:", err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
