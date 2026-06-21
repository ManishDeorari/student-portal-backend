const User = require('../models/User');

/**
 * Increments the user's activity count for today.
 * Extremely lightweight DB operation using $inc on a dynamic map key.
 * @param {String} userId - The ID of the user.
 */
const recordActivity = async (userId) => {
    try {
        if (!userId) return;
        
        // Format date to YYYY-MM-DD in local time
        const date = new Date();
        const dateString = date.toISOString().split('T')[0];

        // Increment the specific date key by 1 using MongoDB's dot notation for Map types
        await User.findByIdAndUpdate(userId, {
            $inc: { [`activityHeatmap.${dateString}`]: 1 }
        });
    } catch (err) {
        console.error("Error recording user activity:", err);
    }
};

module.exports = { recordActivity };
