const Event = require("../../../../models/Event");
const Registration = require("../../../../models/Registration");

const getEventMetadata = async (event, userId) => {
  const ev = event.toObject ? event.toObject({ flattenMaps: true }) : event;
  const registrationCount = await Registration.countDocuments({ eventId: ev._id });
  
  let isRegistered = false;
  let myRegistration = null;
  if (userId) {
    const reg = await Registration.findOne({ eventId: ev._id, userId });
    if (reg) {
      isRegistered = true;
      myRegistration = reg.toObject ? reg.toObject({ flattenMaps: true }) : reg;
    }
  }

  return { 
    ...ev, 
    user: ev.createdBy, 
    type: "Event", 
    content: ev.description,
    registrationCount,
    isRegistered,
    myRegistration
  };
};

const reactToEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id.toString();

    const event = await Event.findById(id);
    if (!event) return res.status(404).json({ error: "Event not found" });

    if (!(event.reactions instanceof Map)) {
      event.reactions = new Map(Object.entries(event.reactions || {}));
    }

    let userAlreadyReacted = false;
    for (const [key, users] of event.reactions.entries()) {
      const filtered = users.filter(uid => uid.toString() !== userId);
      if (key === emoji && filtered.length !== users.length) {
        userAlreadyReacted = true;
      }
      event.reactions.set(key, filtered);
    }

    if (!userAlreadyReacted) {
      const current = event.reactions.get(emoji) || [];
      event.reactions.set(emoji, [...current, userId]);
    }

    await event.save();

    const updatedEvent = await Event.findById(id)
      .populate("createdBy", "name profilePicture")
      .populate({ path: "comments.user", select: "name profilePicture" })
      .populate({ path: "comments.replies.user", select: "name profilePicture" });

    const eventResp = await getEventMetadata(updatedEvent, req.user?._id);
    const broadcastEvent = { ...eventResp, isRegistered: undefined, myRegistration: undefined };

    if (req.io) {
      req.io.emit("postReacted", broadcastEvent);
    }

    res.status(200).json(eventResp);
  } catch (error) {
    console.error("Event reaction error:", error.message);
    res.status(500).json({ error: "Server error" });
  }
};

const commentOnEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    const event = await Event.findById(id);
    if (!event) return res.status(404).json({ error: "Event not found" });

    event.comments.push({
      user: req.user._id,
      text,
      createdAt: new Date(),
    });

    await event.save();

    const updatedEvent = await Event.findById(id)
      .populate("createdBy", "name profilePicture")
      .populate({ path: "comments.user", select: "name profilePicture" })
      .populate({ path: "comments.replies.user", select: "name profilePicture" });

    const eventResp = await getEventMetadata(updatedEvent, req.user?._id);
    const broadcastEvent = { ...eventResp, isRegistered: undefined, myRegistration: undefined };

    if (req.io) {
      req.io.emit("updatePost", broadcastEvent);
    }

    res.status(201).json(eventResp);
  } catch (error) {
    console.error("Event comment error:", error.message);
    res.status(500).json({ error: "Server error" });
  }
};

const editEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;

    const event = await Event.findById(id);
    if (!event) return res.status(404).json({ error: "Event not found" });

    if (event.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (title) event.title = title;
    if (content) event.description = content;

    await event.save();

    const updatedEvent = await Event.findById(id)
      .populate("createdBy", "name profilePicture")
      .populate({ path: "comments.user", select: "name profilePicture" })
      .populate({ path: "comments.replies.user", select: "name profilePicture" });

    const eventResp = await getEventMetadata(updatedEvent, req.user?._id);
    const broadcastEvent = { ...eventResp, isRegistered: undefined, myRegistration: undefined };

    if (req.io) {
      req.io.emit("updatePost", broadcastEvent);
    }

    res.status(200).json(eventResp);
  } catch (error) {
    console.error("Event edit error:", error.message);
    res.status(500).json({ error: "Server error" });
  }
};

const deleteCommentFromEvent = async (req, res) => {
  try {
    const { id: eventId, commentId } = req.params;
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: "Event not found" });

    event.comments = event.comments.filter(c => c._id.toString() !== commentId);
    await event.save();

    const updatedEvent = await Event.findById(eventId)
      .populate("createdBy", "name profilePicture")
      .populate({ path: "comments.user", select: "name profilePicture" })
      .populate({ path: "comments.replies.user", select: "name profilePicture" });

    const eventResp = await getEventMetadata(updatedEvent, req.user?._id);
    const broadcastEvent = { ...eventResp, isRegistered: undefined, myRegistration: undefined };
    if (req.io) req.io.emit("updatePost", broadcastEvent);
    res.json(eventResp);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

const editCommentOnEvent = async (req, res) => {
  try {
    const { id: eventId, commentId } = req.params;
    const { text } = req.body;
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: "Event not found" });

    const comment = event.comments.id(commentId);
    if (comment) {
      comment.text = text;
      await event.save();
    }

    const updatedEvent = await Event.findById(eventId)
      .populate("createdBy", "name profilePicture")
      .populate({ path: "comments.user", select: "name profilePicture" })
      .populate({ path: "comments.replies.user", select: "name profilePicture" });

    const eventResp = await getEventMetadata(updatedEvent, req.user?._id);
    const broadcastEvent = { ...eventResp, isRegistered: undefined, myRegistration: undefined };
    if (req.io) req.io.emit("updatePost", broadcastEvent);
    res.json(eventResp);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

const replyToCommentOnEvent = async (req, res) => {
  try {
    const { id: eventId, commentId } = req.params;
    const { text } = req.body;
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: "Event not found" });

    const comment = event.comments.id(commentId);
    if (!comment) return res.status(404).json({ error: "Comment not found" });

    comment.replies.push({
      user: req.user._id,
      text,
      createdAt: new Date(),
      parentId: commentId,
    });

    await event.save();

    const updatedEvent = await Event.findById(eventId)
      .populate("createdBy", "name profilePicture")
      .populate({ path: "comments.user", select: "name profilePicture" })
      .populate({ path: "comments.replies.user", select: "name profilePicture" });

    const eventResp = await getEventMetadata(updatedEvent, req.user?._id);
    const broadcastEvent = { ...eventResp, isRegistered: undefined, myRegistration: undefined };
    if (req.io) req.io.emit("updatePost", broadcastEvent);
    res.status(201).json(eventResp);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

const reactToCommentOnEvent = async (req, res) => {
  try {
    const { id: eventId, commentId } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id.toString();

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: "Event not found" });

    const comment = event.comments.id(commentId);
    if (!comment) return res.status(404).json({ error: "Comment not found" });

    if (!(comment.reactions instanceof Map)) {
      comment.reactions = new Map(Object.entries(comment.reactions || {}));
    }

    let userAlreadyReacted = false;
    for (const [key, users] of comment.reactions.entries()) {
      const filtered = users.filter((uid) => uid.toString() !== userId);
      if (key === emoji && filtered.length !== users.length) userAlreadyReacted = true;
      comment.reactions.set(key, filtered);
    }

    if (!userAlreadyReacted) {
      const current = comment.reactions.get(emoji) || [];
      comment.reactions.set(emoji, [...current, userId]);
    }

    event.markModified("comments");
    await event.save();

    const updatedEvent = await Event.findById(eventId)
      .populate("createdBy", "name profilePicture")
      .populate({ path: "comments.user", select: "name profilePicture" })
      .populate({ path: "comments.replies.user", select: "name profilePicture" });

    const eventResp = await getEventMetadata(updatedEvent, req.user?._id);
    const broadcastEvent = { ...eventResp, isRegistered: undefined, myRegistration: undefined };
    if (req.io) req.io.emit("updatePost", broadcastEvent);
    res.json(eventResp);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

const editReplyOnEvent = async (req, res) => {
  try {
    const { id: eventId, commentId, replyId } = req.params;
    const { text } = req.body;
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: "Event not found" });

    const comment = event.comments.id(commentId);
    if (!comment) return res.status(404).json({ error: "Comment not found" });

    const reply = comment.replies.id(replyId);
    if (reply) {
      reply.text = text;
      await event.save();
    }

    const updatedEvent = await Event.findById(eventId)
      .populate("createdBy", "name profilePicture")
      .populate({ path: "comments.user", select: "name profilePicture" })
      .populate({ path: "comments.replies.user", select: "name profilePicture" });

    const eventResp = await getEventMetadata(updatedEvent, req.user?._id);
    const broadcastEvent = { ...eventResp, isRegistered: undefined, myRegistration: undefined };
    if (req.io) req.io.emit("updatePost", broadcastEvent);
    res.json(eventResp);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

const deleteReplyOnEvent = async (req, res) => {
  try {
    const { id: eventId, commentId, replyId } = req.params;
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: "Event not found" });

    const comment = event.comments.id(commentId);
    if (!comment) return res.status(404).json({ error: "Comment not found" });

    comment.replies = comment.replies.filter(r => r._id.toString() !== replyId);
    await event.save();

    const updatedEvent = await Event.findById(eventId)
      .populate("createdBy", "name profilePicture")
      .populate({ path: "comments.user", select: "name profilePicture" })
      .populate({ path: "comments.replies.user", select: "name profilePicture" });

    const eventResp = await getEventMetadata(updatedEvent, req.user?._id);
    const broadcastEvent = { ...eventResp, isRegistered: undefined, myRegistration: undefined };
    if (req.io) req.io.emit("updatePost", broadcastEvent);
    res.json(eventResp);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

const reactToReplyOnEvent = async (req, res) => {
  try {
    const { id: eventId, commentId, replyId } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id.toString();

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: "Event not found" });

    const comment = event.comments.id(commentId);
    if (!comment) return res.status(404).json({ error: "Comment not found" });

    const reply = comment.replies.id(replyId);
    if (!reply) return res.status(404).json({ error: "Reply not found" });

    if (!(reply.reactions instanceof Map)) {
      reply.reactions = new Map(Object.entries(reply.reactions || {}));
    }

    let userAlreadyReacted = false;
    for (const [key, users] of reply.reactions.entries()) {
      const filtered = users.filter((uid) => uid.toString() !== userId);
      if (key === emoji && filtered.length !== users.length) userAlreadyReacted = true;
      reply.reactions.set(key, filtered);
    }

    if (!userAlreadyReacted) {
      const current = reply.reactions.get(emoji) || [];
      reply.reactions.set(emoji, [...current, userId]);
    }

    event.markModified("comments");
    await event.save();

    const updatedEvent = await Event.findById(eventId)
      .populate("createdBy", "name profilePicture")
      .populate({ path: "comments.user", select: "name profilePicture" })
      .populate({ path: "comments.replies.user", select: "name profilePicture" });

    const eventResp = await getEventMetadata(updatedEvent, req.user?._id);
    const broadcastEvent = { ...eventResp, isRegistered: undefined, myRegistration: undefined };
    if (req.io) req.io.emit("updatePost", broadcastEvent);
    res.json(eventResp);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  reactToEvent,
  commentOnEvent,
  editEvent,
  deleteCommentFromEvent,
  editCommentOnEvent,
  replyToCommentOnEvent,
  reactToCommentOnEvent,
  editReplyOnEvent,
  deleteReplyOnEvent,
  reactToReplyOnEvent,
};
