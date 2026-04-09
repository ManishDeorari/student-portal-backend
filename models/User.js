const mongoose = require("mongoose");

// ===================== Points Schema (Alumni only) =====================
const PointsSchema = new mongoose.Schema({
  profileCompletion: { type: Number, default: 0 },
  studentEngagement: { type: Number, default: 0 },
  referrals: { type: Number, default: 0 },
  contentContribution: { type: Number, default: 0 },
  campusEngagement: { type: Number, default: 0 },
  innovationSupport: { type: Number, default: 0 },
  alumniParticipation: { type: Number, default: 0 },
  connections: { type: Number, default: 0 },
  posts: { type: Number, default: 0 },
  comments: { type: Number, default: 0 },
  replies: { type: Number, default: 0 },
  penalty: { type: Number, default: 0 },
  login: { type: Number, default: 0 },
  other: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
});

// ===================== Last Year Points Schema =====================
const LastYearPointsSchema = new mongoose.Schema({
  year: { type: String }, // e.g. "2025"
  total: { type: Number, default: 0 },
});

// ===================== Notification Schema =====================
const NotificationSchema = new mongoose.Schema({
  type: { type: String },
  message: { type: String },
  from: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  date: { type: Date, default: Date.now },
  isRead: { type: Boolean, default: false },
});

// ===================== Sub-Schemas =====================
const ExperienceSchema = new mongoose.Schema({
  title: String,
  company: String,
  employmentType: String,
  location: String,
  locationType: String,
  startDate: String,
  endDate: String,
  description: String,
  skills: [String],
});

const EducationSchema = new mongoose.Schema({
  level: String,
  degree: String,
  course: String,
  branch: String,
  fieldOfStudy: String,
  institution: String,
  campus: String,
  location: String,
  startDate: String,
  endDate: String,
  startYear: Number,
  endYear: Number,
  courseYearKey: { type: String, index: true },
  grade: String,
  activities: { type: String, maxlength: 500 },
  description: { type: String, maxlength: 1000 },
});

const WorkProfileSchema = new mongoose.Schema({
  functionalArea: String,
  subFunctionalArea: String,
  experience: String,
  industry: String,
});

const JobPreferencesSchema = new mongoose.Schema({
  functionalArea: String,
  preferredLocations: [String],
  noticePeriod: String,
  salary: String,
  resumeLink: String,
  portfolioLink: String,
});

// ===================== Main User Schema =====================
const UserSchema = new mongoose.Schema(
  {
    // Basic info
    name: { type: String, required: true },
    publicId: { type: String, unique: true, sparse: true, index: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },

    // Alumni-only field
    enrollmentNumber: { type: String, unique: true, sparse: true },

    // Faculty-only field
    employeeId: { type: String, unique: true, sparse: true },

    // Common optional profile fields
    bio: String,
    job: String,
    course: String,
    year: String,
    profilePicture: String,
    bannerImage: String,

    // Detailed Profile Fields
    phone: String,
    address: String,
    whatsapp: String,
    linkedin: String,

    education: [EducationSchema],
    experience: [ExperienceSchema],
    skills: [String],

    workProfile: { type: WorkProfileSchema, default: {} },
    jobPreferences: { type: JobPreferencesSchema, default: {} },

    // Networking connections
    connections: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    pendingRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    sentRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Role & Permission
    role: {
      type: String,
      enum: ["alumni", "faculty", "admin"],
      default: "alumni",
    },
    isAdmin: {
      type: Boolean,
      default: false, // true if admin privileges
    },
    approved: {
      type: Boolean,
      default: false, // must be approved by admin
    },
    isMainAdmin: { type: Boolean, default: false },

    // Points (Alumni only)
    points: { type: PointsSchema, default: () => ({}) },

    // Last Year Points (Alumni only)
    lastYearPoints: { type: LastYearPointsSchema, default: null },

    // Tracking for points (Alumni only)
    postPointLogs: [{ type: Date }], // Dates when post points were awarded
    likePointLogs: [{ type: Date }], // Dates when like points were awarded
    commentPointLogs: [{ type: Date }], // Dates when comment points were awarded
    profileCompletionAwarded: { type: Boolean, default: false },
    lastLoginPointAwardedAt: { type: Date }, // Tracking for daily login points

    // Notifications
    notifications: [NotificationSchema],

    // Visit Tracking
    visitStats: {
      totalVisits: { type: Number, default: 0 },
      todayVisits: { type: Number, default: 0 },
      lastResetTodayVisitsAt: { type: Date, default: Date.now }
    },
    visitors: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        lastVisit: { type: Date, default: Date.now },
      },
    ],

    // Last Seen Tracking (for notification indicators)
    lastSeenPostsAt: { type: Date, default: Date.now, index: true },
    lastSeenGroupsAt: { type: Date, default: Date.now, index: true },
    lastSeenNetworkAt: { type: Date, default: Date.now, index: true },
    lastSeenAdminRequestsAt: { type: Date, default: Date.now, index: true },

    // Reset Password OTP
    resetPasswordOTP: { type: String },
    resetPasswordExpires: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
