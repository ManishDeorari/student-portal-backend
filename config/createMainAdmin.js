const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

async function createMainAdmin() {
  try {
    const adminEmail = "manishdeorari377@gmail.com";
    const existingAdmin = await User.findOne({ email: adminEmail });

    if (existingAdmin) {
      // ✅ Always enforce main admin privileges
      if (!existingAdmin.isMainAdmin) {
        existingAdmin.isMainAdmin = true;
        existingAdmin.isAdmin = true;
        existingAdmin.role = "admin";
        existingAdmin.approved = true;
        await existingAdmin.save();
        console.log("♻️ Existing user upgraded to Main Admin");
      } else {
        console.log("✅ Main Admin already exists and verified");
      }
      return;
    }

    const hashedPassword = await bcrypt.hash("ManPri@2322", 10);

    const mainAdmin = new User({
      name: "Main Admin",
      email: adminEmail,
      password: hashedPassword,
      role: "admin",
      isAdmin: true,
      isMainAdmin: true, // ✅ KEY FLAG
      approved: true,
      employeeId: "EMP001",
    });

    await mainAdmin.save();
    console.log("🚀 Main Admin created successfully!");
  } catch (error) {
    console.error("❌ Error creating Main Admin:", error);
  }
}

module.exports = createMainAdmin;
