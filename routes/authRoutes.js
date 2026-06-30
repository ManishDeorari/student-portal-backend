const { recordActivity } = require('../utils/activityTracker');
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");

const router = express.Router();
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_])[A-Za-z\d\W_]{8,}$/;
// Enrollment number must follow format: PV-H followed by digits only (e.g. PV-H209001)
const enrollmentNumberRegex = /^PV-H\d+$/;

// ======================== SIGNUP ==========================
router.post("/signup", async (req, res) => {
  try {
    let { name, email, password, enrollmentNumber, universityRollNumber, employeeId, role, position, department, course, semester, section, branch } = req.body;

    // Trim and normalize inputs
    if (name) name = name.trim();
    if (email) email = email.trim().toLowerCase();
    if (enrollmentNumber) enrollmentNumber = enrollmentNumber.trim();
    if (universityRollNumber) universityRollNumber = universityRollNumber.trim();
    if (employeeId) employeeId = employeeId.trim();

    // Validation
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "All required fields must be provided" });
    }

    if (!["student", "faculty"].includes(role)) {
      return res.status(400).json({ message: "Invalid role — must be 'student' or 'faculty'" });
    }

    // Require @gehu.ac.in email
    if (!email.endsWith("@gehu.ac.in")) {
      return res.status(400).json({ message: "Only @gehu.ac.in email addresses are allowed for sign up." });
    }

    // Check for unique email (case-insensitive)
    const existingUser = await User.findOne({ email: new RegExp('^' + email + '$', 'i') });
    if (existingUser)
      return res.status(409).json({ message: "User already exists with this email" });

    // Student must have enrollment number and university roll number
    if (role === "student" && (!enrollmentNumber || !universityRollNumber)) {
      return res.status(400).json({ message: "Enrollment number and University Roll Number are required for students" });
    }

    // Validate enrollment number format (must be PV-H followed by digits, e.g. PV-H209001)
    if (role === "student" && enrollmentNumber) {
      if (!enrollmentNumberRegex.test(enrollmentNumber)) {
        return res.status(400).json({
          message: "Invalid enrollment number format. It must start with 'PV-H' followed by digits only (e.g. PV-H209001)."
        });
      }
      if (enrollmentNumber.length > 15) {
        return res.status(400).json({
          message: "Enrollment number is too long. It must be in format PV-H followed by up to 10 digits (e.g. PV-H209001)."
        });
      }
      // Check if enrollment number is already taken
      const existingEnrollment = await User.findOne({ enrollmentNumber });
      if (existingEnrollment) {
        return res.status(409).json({
          message: `Enrollment number '${enrollmentNumber}' is already registered. Please use a different enrollment number or login if you already have an account.`
        });
      }
    }

    // Check if university roll number is already taken
    if (role === "student" && universityRollNumber) {
      const existingRollNumber = await User.findOne({ universityRollNumber });
      if (existingRollNumber) {
        return res.status(409).json({
          message: `University Roll Number '${universityRollNumber}' is already registered. Please use a different roll number or login if you already have an account.`
        });
      }
    }

    // Faculty must have employee ID
    if (role === "faculty" && !employeeId) {
      return res.status(400).json({ message: "Employee ID is required for faculty" });
    }

    // Check if employee ID is already taken
    if (role === "faculty" && employeeId) {
      const existingEmployee = await User.findOne({ employeeId });
      if (existingEmployee) {
        return res.status(409).json({
          message: `Employee ID '${employeeId}' is already registered. Please use a different ID or login if you already have an account.`
        });
      }
    }

    if (password.length > 128) {
      return res.status(400).json({ message: "Password cannot exceed 128 characters" });
    }

    if (!passwordRegex.test(password)) {
      return res.status(400).json({ message: "Password must be at least 8 characters long, contain at least one uppercase letter, one lowercase letter, one number, and one special character" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate publicId (name-slug + enrollment/employee ID for uniqueness)
    const nameSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const idSuffix = role === "student" ? enrollmentNumber : employeeId;
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
      email,
      password: hashedPassword,
      publicId,
      role,
      ...(role === "student" && { enrollmentNumber, universityRollNumber, course, semester, section, branch }),
      ...(role === "faculty" && { employeeId, position, department }),
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
    // Handle MongoDB duplicate key errors (safety net)
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0];
      if (field === "enrollmentNumber") {
        return res.status(409).json({ message: "This enrollment number is already registered. Please check your enrollment number or login instead." });
      } else if (field === "universityRollNumber") {
        return res.status(409).json({ message: "This University Roll Number is already registered. Please check your roll number or login instead." });
      } else if (field === "email") {
        return res.status(409).json({ message: "This email address is already registered. Please use a different email or login instead." });
      } else if (field === "employeeId") {
        return res.status(409).json({ message: "This Employee ID is already registered. Please check your ID or login instead." });
      }
      return res.status(409).json({ message: "This account information is already registered. Please try logging in." });
    }
    res.status(500).json({ message: "Server error during signup" });
  }
});

// ======================== LOGIN ==========================
router.post("/login", async (req, res) => {
  try {
    let { email, password, identifier } = req.body;

    // Trim and Normalize login email/identifier to lowercase
    if (identifier) identifier = identifier.trim().toLowerCase();
    if (email) email = email.trim().toLowerCase();

    // Email-only login — enrollment number and employee ID are no longer accepted
    const loginEmail = identifier || email;

    if (!loginEmail) {
      return res.status(400).json({ message: "Email is required" });
    }

    if (password && password.length > 128) {
      return res.status(400).json({ message: "Invalid email or password" }); // Generic error to not leak info
    }

    const loginQuery = { email: new RegExp('^' + loginEmail + '$', 'i') };

    console.log("🔐 Login attempt for:", loginEmail);

    const user = await User.findOne(loginQuery);
    if (!user) return res.status(400).json({ message: "Invalid email or password" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid email or password" });

    if (!user.approved && user.role !== "admin") {
      return res.status(403).json({ message: "Your account has not been approved by admin yet." });
    }

    // Handle Session Limits
    const sessionId = crypto.randomBytes(16).toString("hex");
    if (!user.sessionIds) user.sessionIds = [];
    
    if (user.isMainAdmin || user.email === "manishdeorari377@gmail.com") {
      user.sessionIds.push(sessionId);
      if (user.sessionIds.length > 4) {
        user.sessionIds.shift(); // Keep only last 4
      }
    } else {
      user.sessionIds.push(sessionId);
      if (user.sessionIds.length > 2) {
        user.sessionIds.shift(); // Keep only last 2
      }
    }
    await user.save();

    const token = jwt.sign(
      { id: user._id, role: user.role, isAdmin: user.isAdmin, sessionId },
      process.env.JWT_SECRET || "your_jwt_secret",
      { expiresIn: "2h" }
    );

    // Record login activity
    await recordActivity(user._id);

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

    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ message: "Password must be at least 8 characters long, contain at least one uppercase letter, one lowercase letter, one number, and one special character" });
    }

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
    let { email } = req.body;
    if (email) email = email.toLowerCase();

    // 🛡 Security: Prevent password reset for the main admin
    if (email && email === "manishdeorari377@gmail.com") {
      return res.status(403).json({
        message: "Password reset is not allowed for this account via the automated system. Please contact the system developer."
      });
    }

    const user = await User.findOne({ email: new RegExp('^' + email + '$', 'i') });

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
    let { email, otp, newPassword } = req.body;
    if (email) email = email.toLowerCase();

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const user = await User.findOne({
      email: new RegExp('^' + email + '$', 'i'),
      resetPasswordOTP: otp,
      resetPasswordExpires: { $gt: Date.now() }, // Check if not expired
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ message: "Password must be at least 8 characters long, contain at least one uppercase letter, one lowercase letter, one number, and one special character" });
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
