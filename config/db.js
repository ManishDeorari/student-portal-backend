const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    if (mongoose.connection.readyState >= 1) {
      console.log("⚡ MongoDB Already Connected");
      return mongoose.connection;
    }

    await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 10,                  // Handle concurrent requests
      serverSelectionTimeoutMS: 15000,  // Wait up to 15s for server selection (cold start)
      socketTimeoutMS: 45000,           // Close sockets after 45s of inactivity
      connectTimeoutMS: 15000,          // Connection attempt timeout
      heartbeatFrequencyMS: 10000,      // Check server health every 10s
    });

    console.log(`✅ MongoDB Connected: ${mongoose.connection.host}`);

    // Log connection events for debugging
    mongoose.connection.on("error", (err) => {
      console.error(`❌ MongoDB Runtime Error: ${err.message}`);
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("⚠️ MongoDB Disconnected. Mongoose will attempt to reconnect...");
    });

    mongoose.connection.on("reconnected", () => {
      console.log("🔄 MongoDB Reconnected successfully.");
    });

    return mongoose.connection;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
