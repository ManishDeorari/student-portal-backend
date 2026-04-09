const User = require("../../../../models/User");

const notify = async (targetUserId, fromUserId, type, message) => {
  if (targetUserId.toString() === fromUserId.toString()) return;

  const user = await User.findById(targetUserId);
  if (!user) return;

  user.notifications.push({
    type,
    message,
    fromUser: fromUserId,
    createdAt: new Date(),
    read: false,
  });

  await user.save();
};

module.exports = notify;
