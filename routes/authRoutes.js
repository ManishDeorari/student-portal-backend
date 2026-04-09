const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const router = express.Router();

// ======================== SIGNUP ==========================
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, enrollmentNumber, employeeId, role } = req.body;

    // Validation
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "All required fields must be provided" });
    }

    if (!["alumni", "faculty"].includes(role)) {
      return res.status(400).json({ message: "Invalid role — must be 'alumni' or 'faculty'" });
    }

    // Check for unique email
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(409).json({ message: "User already exists with this email" });

    // Alumni must have enrollment number
    if (role === "alumni" && !enrollmentNumber) {
      return res.status(400).json({ message: "Enrollment number is required for alumni" });
    }

    // Faculty must have employee ID
    if (role === "faculty" && !employeeId) {
      return res.status(400).json({ message: "Employee ID is required for faculty" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate publicId (name-slug + enrollment/employee ID for uniqueness)
    const nameSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const idSuffix = role === "alumni" ? enrollmentNumber : employeeId;
    const baseSlug = `${nameSlug}-${idSuffix}`;
    let publicId = baseSlug;
    
    // In extremely rare cases where the combined ID isn't unique, loop it.
    let isUnique = false;
    let counter = 1;
    while (!isUnique) {
      const existing = await User.findOne({ publicId });
      if (existing) {
        publicId = `${baseSlug}-${counter}`;
        counter++;
      } else {
        isUnique = true;
      }
    }

    // Create new user
    const newUser = new User({
      name,
      publicId,
      email,
      password: hashedPassword,
      role,
      enrollmentNumber: role === "alumni" ? enrollmentNumber : undefined,
      employeeId: role === "faculty" ? employeeId : undefined,
      isAdmin: false,
      approved: false,
    });

    await newUser.save();
    
    // Notify admins of new signup request
    if (req.io) {
      req.io.emit("newSignupRequest", { 
        userId: newUser._id, 
        name: newUser.name,
        role: newUser.role 
      });
    }

    return res.status(201).json({
      message: "Signup successful! Please wait for admin approval.",
    });
  } catch (err) {
    console.error("❌ Signup error:", err.message);
    res.status(500).json({ message: "Server error during signup" });
  }
});

// ======================== LOGIN ==========================
router.post("/login", async (req, res) => {
  try {
    const { email, enrollmentNumber, employeeId, password, identifier } = req.body;

    // Support both old format (email/enrollmentNumber) and new format (identifier)
    let loginQuery = {};
    if (identifier) {
      loginQuery = {
        $or: [
          { email: identifier },
          { enrollmentNumber: identifier },
          { employeeId: identifier }
        ]
      };
    } else if (email) {
      loginQuery = { email };
    } else if (enrollmentNumber) {
      loginQuery = { enrollmentNumber };
    } else if (employeeId) {
      loginQuery = { employeeId };
    } else {
      return res.status(400).json({ message: "Email or ID is required" });
    }

    console.log("🔐 Login attempt with query:", loginQuery);

    const user = await User.findOne(loginQuery);
    if (!user) return res.status(400).json({ message: "Invalid email/ID or password" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid email/ID or password" });

    if (!user.approved && user.role !== "admin") {
      return res.status(403).json({ message: "Your account has not been approved by admin yet." });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role, isAdmin: user.isAdmin },
      process.env.JWT_SECRET || "your_jwt_secret",
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isAdmin: user.isAdmin,
        approved: user.approved,
      },
    });
  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({ message: "Something went wrong during login" });
  }
});

const authMiddleware = require("../middleware/authMiddleware");

// ======================== RESET PASSWORD ==========================
router.post("/reset-password", authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user._id;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new passwords are required" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Verify old password
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid current password" });

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedNewPassword;
    await user.save();

    res.json({ message: "Password reset successful" });
  } catch (err) {
    console.error("❌ Reset password error:", err.message);
    res.status(500).json({ message: "Server error during password reset" });
  }
});

const { sendOTPEmail } = require("../utils/emailService");

// ======================== FORGOT PASSWORD (OTP) ==========================
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    // 🛡 Security: Prevent password reset for the main admin
    if (email === "manishdeorari377@gmail.com") {
      return res.status(403).json({
        message: "Password reset is not allowed for this account via the automated system. Please contact the system developer."
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User with this email does not exist" });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save OTP and expiration (60 seconds)
    user.resetPasswordOTP = otp;
    user.resetPasswordExpires = Date.now() + 60000; // 60 seconds
    await user.save();

    // Send OTP via email
    await sendOTPEmail(user.email, otp);

    res.json({ message: "OTP sent to your email. Expires in 60 seconds." });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Server error processing request" });
  }
});

// ======================== RESET PASSWORD WITH OTP ==========================
router.post("/reset-password-with-otp", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const user = await User.findOne({
      email,
      resetPasswordOTP: otp,
      resetPasswordExpires: { $gt: Date.now() }, // Check if not expired
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;

    // Clear OTP fields
    user.resetPasswordOTP = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: "Password has been reset successfully. Please login." });
  } catch (error) {
    console.error("Reset password with OTP error:", error);
    res.status(500).json({ message: "Server error resetting password" });
  }
});

module.exports = router;
