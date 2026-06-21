const User = require('../models/User');

/**
 * Increments the user's activity count for today.
 * Extremely lightweight DB operation.
 * @param {String} userId - The ID of the user.
 */
const recordActivity = async (userId) => {
    try {
        if (!userId) return;
        
        // Format date to YYYY-MM-DD in local time
        const date = new Date();
        const dateString = date.toISOString().split('T')[0];

        const user = await User.findById(userId);
        if (!user) return;

        // Initialize map if it doesn't exist
        if (!user.activityHeatmap) {
            user.activityHeatmap = new Map();
        }

        // Get current count
        const currentCount = user.activityHeatmap.get(dateString) || 0;
        user.activityHeatmap.set(dateString, currentCount + 1);

        // Force mongoose to recognize the change in the Map
        user.markModified('activityHeatmap');
        
        await user.save();
    } catch (err) {
        console.error("Error recording user activity:", err);
    }
};

module.exports = { recordActivity };
