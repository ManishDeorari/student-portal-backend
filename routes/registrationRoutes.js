const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");

const registerEvent = require("../src/api/events/registration/register");
const getRegistrations = require("../src/api/events/registration/getRegistrations");
const downloadCSV = require("../src/api/events/registration/downloadCSV");

// ---------------- REGISTER FOR EVENT ----------------
router.post("/", auth, registerEvent);

// ---------------- VIEW REGISTRATIONS (Admin only) ----------------
router.get("/:eventId", auth, getRegistrations);

// ---------------- DOWNLOAD CSV (Admin only) ----------------
router.get("/:eventId/download", auth, downloadCSV);

module.exports = router;
