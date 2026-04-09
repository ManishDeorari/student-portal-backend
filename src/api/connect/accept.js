router.post("/accept", authMiddleware, async (req, res) => {
    const { fromUserId } = req.body;
  
    try {
      const currentUser = await User.findById(req.user.id);
      const fromUser = await User.findById(fromUserId);
  
      if (!fromUser) return res.status(404).json({ message: "User not found" });
  
      // Initialize arrays if missing
      if (!currentUser.connections) currentUser.connections = [];
      if (!fromUser.connections) fromUser.connections = [];
      if (!currentUser.pendingRequests) currentUser.pendingRequests = [];
      if (!fromUser.sentRequests) fromUser.sentRequests = [];

      // Add to connections if not already connected
      if (!currentUser.connections.includes(fromUser._id)) {
        currentUser.connections.push(fromUser._id);
        fromUser.connections.push(currentUser._id);
      }
  
      // Remove from pending/sent lists
      currentUser.pendingRequests = currentUser.pendingRequests.filter(
        (id) => id.toString() !== fromUserId
      );
      fromUser.sentRequests = fromUser.sentRequests.filter(
        (id) => id.toString() !== currentUser._id.toString()
      );
  
      await currentUser.save();
      await fromUser.save();

      // ✅ Real-time Notification for the requester
      const Notification = require("../../models/Notification");
      const newNotification = new Notification({
        sender: currentUser._id,
        receiver: fromUser._id,
        type: "connect_accept",
        message: `${currentUser.name} accepted your connection request.`,
        createdAt: new Date()
      });

      await newNotification.save();

      if (req.io) {
        const populatedNotification = await Notification.findById(newNotification._id)
          .populate("sender", "name profilePicture");
        req.io.to(fromUserId.toString()).emit("newNotification", populatedNotification);
      }
  
      res.json({ message: "Connection accepted" });
    } catch (err) {
      console.error("❌ Accept connection failed:", err);
      res.status(500).json({ message: err.message });
    }
  });
  