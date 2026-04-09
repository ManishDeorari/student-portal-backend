const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");

const createEvent = require("../src/api/events/event/createEvent");
const { getEvents, getEventById } = require("../src/api/events/event/getEvents");
const deleteEvent = require("../src/api/events/event/deleteEvent");
const { 
  reactToEvent, 
  commentOnEvent, 
  editEvent, 
  deleteCommentFromEvent, 
  editCommentOnEvent,
  replyToCommentOnEvent,
  reactToCommentOnEvent,
  editReplyOnEvent,
  deleteReplyOnEvent,
  reactToReplyOnEvent
} = require("../src/api/events/event/eventController");

// ---------------- GET ALL EVENTS ----------------
router.get("/", auth, getEvents);

// ---------------- GET SINGLE EVENT ----------------
router.get("/:id", auth, getEventById);

// ---------------- CREATE EVENT (Admin only) ----------------
router.post("/", auth, createEvent);

// ---------------- REACT TO EVENT ----------------
router.patch("/:id/react", auth, reactToEvent);

// ---------------- COMMENT ON EVENT ----------------
router.post("/:id/comment", auth, commentOnEvent);

// ---------------- EDIT COMMENT ON EVENT ----------------
router.put("/:id/comment/:commentId", auth, editCommentOnEvent);

// ---------------- DELETE COMMENT ON EVENT ----------------
router.delete("/:id/comment/:commentId", auth, deleteCommentFromEvent);

// ---------------- REACT TO COMMENT ON EVENT ----------------
router.post("/:id/comment/:commentId/react", auth, reactToCommentOnEvent);

// ---------------- REPLY TO COMMENT ON EVENT ----------------
router.post("/:id/comment/:commentId/reply", auth, replyToCommentOnEvent);

// ---------------- EDIT REPLY ON EVENT ----------------
router.put("/:id/comment/:commentId/reply/:replyId", auth, editReplyOnEvent);

// ---------------- DELETE REPLY ON EVENT ----------------
router.delete("/:id/comment/:commentId/reply/:replyId", auth, deleteReplyOnEvent);

// ---------------- REACT TO REPLY ON EVENT ----------------
router.post("/:id/comment/:commentId/reply/:replyId/react", auth, reactToReplyOnEvent);

// ---------------- EDIT EVENT ----------------
router.patch("/:id", auth, editEvent);

// ---------------- DELETE EVENT (Admin only) ----------------
router.delete("/:id", auth, deleteEvent);

module.exports = router;
