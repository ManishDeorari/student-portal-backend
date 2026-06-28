// routes/connect/search.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middleware/authMiddleware");
const User = require("../../models/User");

router.get("/", authMiddleware, async (req, res) => {
  const { query, course, year, semester, branch, section, department, position, industry, skills } = req.query;

  try {
    const currentUserId = req.user._id;
    const currentUser = await User.findById(currentUserId);
    if (!currentUser) return res.status(404).json({ message: "User not found" });

    const filter = { _id: { $ne: currentUserId }, approved: true };

    const conditions = [];

    if (query) {
      const regex = new RegExp(query, "i");
      conditions.push({
        $or: [
          { name: regex },
          { email: regex },
          { enrollmentNumber: regex },
          { employeeId: regex },
          { course: regex }
        ]
      });
    }

    if (course && year) {
      conditions.push({
        $or: [
          { "education.courseYearKey": `${String(course).toUpperCase()}_${year}` },
          { course: new RegExp(`^${course}$`, "i"), year: String(year) }
        ]
      });
    } else if (course) {
      conditions.push({
        $or: [
          { "education.course": String(course).toUpperCase() },
          { course: new RegExp(`^${course}$`, "i") }
        ]
      });
    } else if (year) {
      conditions.push({
        $or: [
          { "education.endYear": Number(year) },
          { year: String(year) }
        ]
      });
    }

    if (conditions.length > 0) {
      filter.$and = conditions;
    }

    if (semester) {
      filter.semester = String(semester);
    }
    if (branch) {
      filter.branch = new RegExp(`^${branch}$`, "i");
    }
    if (section) {
      filter.section = new RegExp(`^${section}$`, "i");
    }
    if (department) {
      filter.department = new RegExp(department, "i");
    }
    if (position) {
      filter.position = new RegExp(position, "i");
    }

    if (industry) filter["workProfile.industry"] = { $regex: new RegExp(industry, "i") };

    if (skills) {
      const skillsArray = skills.split(",").map(s => s.trim());
      filter.skills = { $in: skillsArray.map(s => new RegExp(s, "i")) };
    }

    const users = await User.find(filter)
      .select("name email enrollmentNumber employeeId role course year profilePicture profileImageFocus bannerImageFocus connections pendingRequests sentRequests workProfile skills profileCompletionAwarded")
      .limit(50);

    // Convert current user's lists to string arrays safely
    const myConnStr = (currentUser.connections || []).map(id => id.toString());
    const mySentStr = (currentUser.sentRequests || []).map(id => id.toString());
    const myPendStr = (currentUser.pendingRequests || []).map(id => id.toString());

    // mark relationship status
    const result = users.map((u) => {
      const uIdStr = u._id.toString();
      let status = "none";

      if (myConnStr.includes(uIdStr)) status = "connected";
      else if (mySentStr.includes(uIdStr)) status = "sent";
      else if (myPendStr.includes(uIdStr)) status = "pending";

      return {
        ...u.toObject(),
        connectionStatus: status,
      };
    });

    res.json(result);
  } catch (err) {
    console.error("Search Error:", err.stack);
    res.status(500).json({ message: "Search failed", error: err.message });
  }
});

module.exports = router;
