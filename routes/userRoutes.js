const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const {
  getMyProfile,
  updateMyProfile,
  getAllUsers,
  getConnectedUsers,
  sendConnectionRequest,
  acceptConnectionRequest,
  getPublicProfile,
  addPoints,
  getAwardEligibleUsers,
  getMyPosts,
  getMyActivity,
  searchUsers,
} = require("../src/api/user/userController");

// ------- PROFILE ROUTES -------
router.get("/me", auth, getMyProfile);
router.put("/update", auth, updateMyProfile);
router.get("/myposts", auth, getMyPosts);
// ------- CONNECTION ROUTES -------
router.get("/all", auth, getAllUsers);
router.get("/connected", auth, getConnectedUsers);
router.post("/request/:id", auth, sendConnectionRequest);
router.post("/accept/:id", auth, acceptConnectionRequest);

// ------- POINTS ROUTES -------
router.patch("/points/add", auth, addPoints);
router.get("/award-eligible", auth, getAwardEligibleUsers);


router.get("/search", auth, searchUsers);
// ------- DYNAMIC ROUTES (MUST BE LAST) -------
router.get("/:id", auth, getPublicProfile);

module.exports = router;
