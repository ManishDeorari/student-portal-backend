const express = require("express");
const router = express.Router();
const authenticate = require("../../middleware/authMiddleware");
const User = require("../../models/User");

// Get a specific user's connections
router.get("/:id", authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .populate("connections", "name profilePicture course year enrollmentNumber employeeId publicId workProfile")
            .select("connections name");

        if (!user) return res.status(404).json({ message: "User not found" });

        res.status(200).json(user.connections);
    } catch (err) {
        console.error("User Connections Error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

module.exports = router;
