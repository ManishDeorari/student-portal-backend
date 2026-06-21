const mongoose = require("mongoose");
const User = require("./models/User");
require("dotenv").config();

async function createMutualConnections() {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log("Connected to MongoDB.");

        // Find at least 4 users to connect
        const users = await User.find({}).limit(5);
        if (users.length < 4) {
            console.log("Not enough users to create mutual connections.");
            process.exit(0);
        }

        const userA = users[0];
        const userB = users[1];
        
        // Connect userA and userB to users[2], users[3], users[4]
        const mutualIds = [users[2]._id, users[3]._id, users[4]._id];

        // Ensure userA has these connections
        mutualIds.forEach(id => {
            if (!userA.connections.includes(id)) {
                userA.connections.push(id);
            }
        });

        // Ensure userB has these connections
        mutualIds.forEach(id => {
            if (!userB.connections.includes(id)) {
                userB.connections.push(id);
            }
        });

        await userA.save();
        await userB.save();

        console.log(`Successfully created mutual connections!`);
        console.log(`Log in as: ${userA.email}`);
        console.log(`And visit the profile of: ${userB.email}`);
        
    } catch (err) {
        console.error("Error creating mutual connections:", err);
    } finally {
        mongoose.disconnect();
    }
}

createMutualConnections();
