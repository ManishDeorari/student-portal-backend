const mongoose = require("mongoose");
require("dotenv").config({ path: "../.env" });

const User = require("../models/User");

async function runMigration() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("🟢 Connected to MongoDB. Starting publicId migration...");

    // Fetch ALL users to regenerate their publicId to the new format
    const usersToUpdate = await User.find({});
    console.log(`Found ${usersToUpdate.length} total users to migrate.`);

    let updatedCount = 0;

    for (let user of usersToUpdate) {
      const nameSlug = (user.name || "user")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      // For alumni, use enrollmentNumber. For faculty, use employeeId.
      const idSuffix = user.role === "faculty" ? user.employeeId : user.enrollmentNumber;
      
      // Combine name slug and ID suffix. Fallback to name slug if ID is somehow missing.
      const baseSlug = idSuffix ? `${nameSlug}-${idSuffix}` : nameSlug;
      let publicId = baseSlug;
      
      let isUnique = false;
      let counter = 1;

      while (!isUnique) {
        // We must check if ANY OTHER user already has this publicId
        const existing = await User.findOne({ publicId });
        if (existing && existing._id.toString() !== user._id.toString()) {
          publicId = `${baseSlug}-${counter}`;
          counter++;
        } else {
          isUnique = true;
        }
      }

      await User.updateOne({ _id: user._id }, { publicId: publicId });
      console.log(`✅ Updated publicId to @${publicId} for user: ${user.name}`);
      updatedCount++;
    }

    console.log(`\n🎉 Migration successfully completed. Updated ${updatedCount} users.`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  }
}

runMigration();
