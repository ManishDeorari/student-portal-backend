const User = require('../models/User');

const recordActivity = async (userId) => {
    try {
        if (!userId) return;
        const date = new Date();
        const dateString = date.toISOString().split('T')[0];

        const user = await User.findById(userId);
        if (!user) return;

        // Initialize object if it doesn't exist
        if (!user.activityHeatmap) {
            user.activityHeatmap = {};
        }

        // We use plain object syntax now since it's type: Object
        let heatmapObj = user.activityHeatmap instanceof Map 
            ? Object.fromEntries(user.activityHeatmap) 
            : user.activityHeatmap;

        const currentCount = heatmapObj[dateString] || 0;
        heatmapObj[dateString] = currentCount + 1;

        // Save it back and force Mongoose to recognize change
        user.activityHeatmap = heatmapObj;
        user.markModified('activityHeatmap');
        
        await user.save();
    } catch (err) {
        console.error("Error recording user activity:", err);
    }
};

module.exports = { recordActivity };