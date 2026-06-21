const User = require("../../../../models/User");

module.exports = async (req, res) => {
  try {
    const { id } = req.params; // The user whose skill is being endorsed
    const { skillName } = req.body;
    const endorserId = req.user.id; // The user doing the endorsing

    if (!skillName) {
      return res.status(400).json({ message: "Skill name is required" });
    }

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // You cannot endorse yourself
    if (id.toString() === endorserId.toString()) {
      return res.status(400).json({ message: "You cannot endorse your own skills" });
    }

    // Find the skill
    const skillIndex = targetUser.profileSkills.findIndex(
      (s) => s.name.toLowerCase() === skillName.toLowerCase()
    );

    if (skillIndex === -1) {
      return res.status(404).json({ message: "Skill not found on user profile" });
    }

    const hasEndorsed = targetUser.profileSkills[skillIndex].endorsements.includes(endorserId);

    if (hasEndorsed) {
      // Remove endorsement
      targetUser.profileSkills[skillIndex].endorsements = targetUser.profileSkills[skillIndex].endorsements.filter(
        (userId) => userId.toString() !== endorserId.toString()
      );
    } else {
      // Add endorsement
      targetUser.profileSkills[skillIndex].endorsements.push(endorserId);
      
      // Send Notification (optional)
      try {
        const Notification = require("../../../../models/Notification");
        const endorser = await User.findById(endorserId).select("name");
        if (endorser) {
          const newNotification = new Notification({
            sender: endorserId,
            receiver: targetUser._id,
            type: "skill_endorsed",
            message: `${endorser.name} endorsed you for your skill in ${skillName}.`,
          });
          await newNotification.save();
        }
      } catch (err) {
        console.error("Failed to send endorsement notification:", err);
      }
    }

    await targetUser.save();

    res.status(200).json(targetUser.profileSkills);
  } catch (error) {
    console.error("Error toggling endorsement:", error);
    res.status(500).json({ message: "Server Error" });
  }
};
