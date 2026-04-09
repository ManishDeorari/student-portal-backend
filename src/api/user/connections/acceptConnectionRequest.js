const User = require("../../../../models/User");

module.exports = async (req, res) => {
  try {
    const sender = await User.findById(req.params.id);
    const receiver = await User.findById(req.user.id);

    if (!sender || !receiver) return res.status(404).json({ message: "User not found" });

    if (!receiver.pendingRequests.includes(sender._id)) {
      return res.status(400).json({ message: "No such request" });
    }

    receiver.connections.push(sender._id);
    sender.connections.push(receiver._id);

    receiver.pendingRequests = receiver.pendingRequests.filter(
      (id) => id.toString() !== sender._id.toString()
    );
    sender.sentRequests = sender.sentRequests.filter(
      (id) => id.toString() !== receiver._id.toString()
    );

    await receiver.save();
    await sender.save();

    res.json({ message: "Connection accepted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
