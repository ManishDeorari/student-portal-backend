const User = require("../../../../models/User");

module.exports = async (req, res) => {
  try {
    const receiver = await User.findById(req.params.id);
    const sender = await User.findById(req.user.id);

    if (!receiver || !sender) return res.status(404).json({ message: "User not found" });

    if (
      receiver.pendingRequests.includes(sender._id) ||
      receiver.connections.includes(sender._id)
    ) {
      return res.status(400).json({ message: "Already requested or connected" });
    }

    receiver.pendingRequests.push(sender._id);
    sender.sentRequests.push(receiver._id);

    await receiver.save();
    await sender.save();

    res.json({ message: "Connection request sent" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
