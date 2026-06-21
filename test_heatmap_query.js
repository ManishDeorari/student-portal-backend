require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://manishdeorari377:Kukku865@cluster0.dbwpe.mongodb.net/portal?retryWrites=true&w=majority';

async function testQuery() {
    try {
        await mongoose.connect(MONGO_URI);
        const user = await User.findOne({ role: 'student' }).select('activityHeatmap name');
        console.log("User:", user.name);
        console.log("Heatmap via object:", user.toObject().activityHeatmap);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
testQuery();
