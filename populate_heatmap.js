require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://manishdeorari377:Kukku865@cluster0.dbwpe.mongodb.net/portal?retryWrites=true&w=majority';

async function populateHeatmap() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to DB');

        const users = await User.find({});
        console.log(`Found ${users.length} users. Adding fake heatmap data...`);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const user of users) {
            const fakeMap = {};
            
            // Generate random activity for the last 60 days
            for (let i = 0; i < 60; i++) {
                const date = new Date(today);
                date.setDate(today.getDate() - i);
                const dateString = date.toISOString().split('T')[0];
                
                // 70% chance to have activity
                if (Math.random() > 0.3) {
                    // Random count between 1 and 8
                    fakeMap[dateString] = Math.floor(Math.random() * 8) + 1;
                }
            }

            // Also add some random sparse activity for older days (up to 300 days)
            for (let i = 60; i < 300; i++) {
                if (Math.random() > 0.8) {
                    const date = new Date(today);
                    date.setDate(today.getDate() - i);
                    const dateString = date.toISOString().split('T')[0];
                    fakeMap[dateString] = Math.floor(Math.random() * 4) + 1;
                }
            }

            user.activityHeatmap = fakeMap;
            await user.save();
        }

        console.log('Done populating heatmap data for all users!');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

populateHeatmap();
