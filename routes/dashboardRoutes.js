const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const getDashboardStats = require("../src/api/dashboard/getDashboardStats");

router.get("/stats", verifyToken, getDashboardStats);

module.exports = router;
