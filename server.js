require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const postRoutes = require("./routes/postRoutes");
const pendingRoute = require("./routes/connect/pending");
const adminPointsRoutes = require("./routes/adminPointsRoutes");
const connectRequestRoute = require("./routes/connect/request");
const connectAcceptRoute = require("./routes/connect/accept");
const connectRejectRoute = require("./routes/connect/reject");
const connectListRoute = require("./routes/connect/list");
const connectCancelRoute = require("./routes/connect/cancel");
const connectSuggestionsRoute = require("./routes/connect/suggestions");
const connectSearchRoute = require("./routes/connect/search");
const connectSentRoute = require("./routes/connect/sent");
const userConnectionsRoute = require("./routes/connect/userConnections");
const createMainAdmin = require("./config/createMainAdmin");
const yearRolloverRoute = require("./routes/admin/yearRollover");
const rolloverConfigRoute = require("./routes/admin/rolloverConfig");
const pointsSystemRoutes = require("./routes/admin/pointsSystemRoutes");
const pointsRequestRoutes = require("./routes/pointsRequestRoutes");

// ✅ NEW: Admin Dashboard routes
const adminRoutes = require("./routes/admin");
const notificationRoutes = require("./routes/notificationRoutes");
const countRoutes = require("./routes/countRoutes");

// ✅ CORS Configuration
const allowedOrigins = [
  "https://alumni-portal-frontend-khaki.vercel.app",
  "https://alumni-frontend.vercel.app",
  "https://alumni-portal-frontend-git-main-manishdeoraris-projects.vercel.app",
  "https://alumni-portal-frontend-70ml39lrm-manishdeoraris-projects.vercel.app",
  "https://alumni-portal-frontend-manishdeoraris-projects.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

// Add origins from env if provided
if (process.env.ALLOWED_ORIGINS) {
  const envOrigins = process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim());
  envOrigins.forEach(o => {
    if (o && !allowedOrigins.includes(o)) {
      allowedOrigins.push(o);
    }
  });
}

// ✅ Dynamic Vercel subdomain patterns (catches ALL preview/branch URLs)
const vercelPatterns = [
  /^https:\/\/alumni-portal-frontend[\w-]*\.vercel\.app$/,
  /^https:\/\/alumni-frontend[\w-]*\.vercel\.app$/,
  /^https:\/\/[\w-]*manishdeoraris-projects\.vercel\.app$/,
];

const corsOptions = {
  origin: function (origin, callback) {
    console.log(`📡 CORS Request from: ${origin || 'No Origin'}`);
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    // 1. Check hardcoded list
    if (allowedOrigins.includes(origin)) {
      console.log(`✅ CORS Match found in allowedOrigins: ${origin}`);
      return callback(null, true);
    }

    // 2. Check dynamic Vercel patterns
    if (vercelPatterns.some(pattern => pattern.test(origin))) {
      console.log(`✅ CORS Match found in vercelPatterns: ${origin}`);
      return callback(null, true);
    }

    // 3. Check local/network IPs
    const isLocal = 
      origin.startsWith("http://localhost:") || 
      origin.startsWith("http://127.0.0.1:") ||
      /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/.test(origin) ||
      /^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/.test(origin) ||
      /^http:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+(:\d+)?$/.test(origin);

    if (isLocal) {
      callback(null, true);
    } else {
      console.warn(`⚠️ [CORS] Blocked request from unauthorized origin: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  exposedHeaders: ["set-cookie"],
  maxAge: 86400 // 24 hours
};

const app = express();
const server = http.createServer(app);

// ✅ Apply CORS early
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

const io = new Server(server, {
  cors: corsOptions,
});

// ✅ NEW: Health Check Route (Before heavy middleware)
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/", (req, res) => {
  res.send("✅ API is running...");
});

// ✅ Use the port Render provides
const PORT = process.env.PORT || 5000;

// ✅ Connect to MongoDB FIRST, then start the server
console.log("📡 Attempting MongoDB connection...");
connectDB().then(async () => {
  await createMainAdmin(); // ensure main admin exists
  const User = require("./models/User");
  await User.syncIndexes();
  console.log("✅ Database ready. Starting HTTP server...");

  // ✅ Start Server ONLY after DB is connected
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}).catch((err) => {
  console.error("❌ Failed to initialize database:", err.message);
  process.exit(1);
});

// ✅ Inject `io` into every request
app.use((req, res, next) => {
  req.io = io;
  next();
});


// ✅ Handle socket events
io.on("connection", (socket) => {
  console.log(`📡 [Socket] New connection: ${socket.id}`);

  socket.on("join", (userId) => {
    if (!userId) {
      console.warn(`⚠️ [Socket] User tried to join with empty ID (socket: ${socket.id})`);
      return;
    }
    socket.join(userId);
    console.log(`👤 [Socket] User ${userId} joined their room (socket: ${socket.id})`);
  });

  socket.on("joinGroup", (groupId) => {
    if (!groupId) return;
    socket.join(`group_${groupId}`);
    console.log(`👥 [Socket] User joined group room group_${groupId} (socket: ${socket.id})`);
  });

  socket.on("leaveGroup", (groupId) => {
    if (!groupId) return;
    socket.leave(`group_${groupId}`);
    console.log(`👥 [Socket] User left group room group_${groupId} (socket: ${socket.id})`);
  });

  socket.on("disconnect", (reason) => {
    console.log(`❌ [Socket] Disconnected: ${socket.id} (Reason: ${reason})`);
  });
});

// ✅ Middleware
console.log("🟢 Middleware setup...");
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb", parameterLimit: 50000 }));



// ✅ Routes
console.log("🔁 Route setup...");
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/connect/pending", pendingRoute);
app.use("/api/admin-points", adminPointsRoutes);
app.use("/api/admin", adminRoutes); // ✅ NEW ADMIN ROUTES
app.use("/api/connect/request", connectRequestRoute);
app.use("/api/connect/accept", connectAcceptRoute);
app.use("/api/connect/reject", connectRejectRoute);
app.use("/api/connect/list", connectListRoute);
app.use("/api/connect/cancel", connectCancelRoute);
app.use("/api/connect/suggestions", connectSuggestionsRoute);
app.use("/api/connect/search", connectSearchRoute);
app.use("/api/connect/sent", connectSentRoute);
app.use("/api/connect/user", userConnectionsRoute);
app.use("/api/admin", yearRolloverRoute);
app.use("/api/admin", rolloverConfigRoute);
app.use("/api/admin-points-mgmt", pointsSystemRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/groups", require("./routes/groupRoutes")); // ✅ Group Routes
app.use("/api/counts", countRoutes);
app.use("/api/events", require("./routes/eventRoutes"));
app.use("/api/registrations", require("./routes/registrationRoutes"));
app.use("/api/points-requests", pointsRequestRoutes);

// ✅ Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(500).json({ message: "Server Error" });
});

// ✅ Server is now started inside connectDB().then() above
