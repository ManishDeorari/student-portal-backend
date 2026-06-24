const mongoose = require("mongoose");

// ===================== Points Schema (Student only) =====================
const PointsSchema = new mongoose.Schema({
  profileCompletion: { type: Number, default: 0 },
  studentEngagement: { type: Number, default: 0 },
  referrals: { type: Number, default: 0 },
  contentContribution: { type: Number, default: 0 },
  campusEngagement: { type: Number, default: 0 },
  innovationSupport: { type: Number, default: 0 },
  studentParticipation: { type: Number, default: 0 },
  connections: { type: Number, default: 0 },
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
  isInternship: { type: Boolean, default: false },
  proofImage: String,
});

const CertificateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  issuer: String,
  description: String,
  issueDate: String,
  duration: String,
  credentialUrl: String,
  proofImage: String,
});

const ProjectSchema = new mongoose.Schema({
  title: { type: String, required: true },
  domain: { type: String, default: "" },
  goal: { type: String, required: true },
  description: { type: String },
  startDate: { type: String },
  endDate: { type: String },
  isOngoing: { type: Boolean, default: false },
  toolsUsed: [String],
  link: String,
  isLinkPublic: { type: Boolean, default: false },
});

const ResearchPaperSchema = new mongoose.Schema({
  title: { type: String, required: true },
  publisher: String,
  publishDate: String,
  description: String,
  link: String,
});

const AchievementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  date: String,
  proofImage: String,
});

const CustomLinkSchema = new mongoose.Schema({
  title: { type: String, required: true },
  url: { type: String, required: true },
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

const SkillSchema = new mongoose.Schema({
  name: { type: String, required: true },
  endorsements: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
});

const FeaturedSchema = new mongoose.Schema({
  title: { type: String, required: true },
  url: { type: String, required: true },
  type: { type: String, enum: ['github', 'youtube', 'portfolio', 'post', 'other'], default: 'other' }
});

// ===================== Main User Schema =====================
const UserSchema = new mongoose.Schema(
  {
    // Basic info
    name: { type: String, required: true },
    publicId: { type: String, unique: true, sparse: true, index: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },

    // Student-only field
    enrollmentNumber: { type: String, unique: true, sparse: true },

    // Faculty-only field
    employeeId: { type: String, unique: true, sparse: true },

    // Common optional profile fields
    bio: String,
    job: String,
    course: String,
    year: String,
    semester: Number,
    section: String,
    position: String,
    department: String,
    profilePicture: String,
    profileImageFocus: { x: Number, y: Number },
    bannerImage: String,
    bannerImageFocus: { x: Number, y: Number },
    secondaryEmail: String,
    universityRollNumber: String,
    branch: String,

    // Detailed Profile Fields
    phone: String,
    address: String,
    whatsapp: String,
    linkedin: String,

    education: [EducationSchema],
    experience: [ExperienceSchema],
    skills: [String], // Legacy skills array
    profileSkills: [SkillSchema], // New skills array with endorsements
    featured: [FeaturedSchema], // Featured/pinned links
    certificates: [CertificateSchema],
    projects: [ProjectSchema],
    researchPapers: [ResearchPaperSchema],
    achievements: [AchievementSchema],
    languages: [String],
    customLinks: [CustomLinkSchema],

    // Resume and Links
    resume: String,
    github: String,
    portfolio: String,

    resumePointsStatus: { type: String, enum: ["none", "pending", "approved", "rejected"], default: "none" },
    githubPointsStatus: { type: String, enum: ["none", "pending", "approved", "rejected"], default: "none" },
    portfolioPointsStatus: { type: String, enum: ["none", "pending", "approved", "rejected"], default: "none" },
    experiencePointsStatus: { type: String, enum: ["none", "pending", "approved", "rejected"], default: "none" },

    // Networking connections
    connections: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    pendingRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    sentRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Activity Heatmap
    activityHeatmap: { type: Object, default: {} },

    // Role & Permission
    role: {
      type: String,
      enum: ["student", "alumni", "faculty", "admin"],
      default: "student",
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

    // Points (Student only)
    points: { type: PointsSchema, default: () => ({}) },

    // Last Year Points (Student only)
    lastYearPoints: { type: LastYearPointsSchema, default: null },

    // Tracking for points (Student only)
    postPointLogs: [{ type: Date }], // Dates when post points were awarded
    likePointLogs: [{ type: Date }], // Dates when like points were awarded
    commentPointLogs: [{ type: Date }], // Dates when comment points were awarded
    profileCompletionAwarded: { type: Boolean, default: false },
    pointsAwardedForSkills: { type: Number, default: 0 }, // Tracks points given for skills
    pointsAwardedForCertificates: { type: Number, default: 0 }, // Tracks points given for certificates
    pointsAwardedForProjects: { type: Number, default: 0 }, // Tracks points given for projects
    eventPointsAwarded: [{ type: mongoose.Schema.Types.ObjectId, ref: "Event" }],
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

    // Session Management (to limit active logins)
    sessionIds: [{ type: String }],

    // Reset Password OTP
    resetPasswordOTP: { type: String },
    resetPasswordExpires: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
