const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const { getUnreadCounts, markAsSeen } = require("../src/api/counts/countController");

router.get("/unread", auth, getUnreadCounts);
router.put("/mark-seen/:section", auth, markAsSeen);

module.exports = router;
