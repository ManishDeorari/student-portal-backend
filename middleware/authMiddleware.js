const jwt = require("jsonwebtoken");
const User = require("../models/User"); // Make sure this path is correct

module.exports = async function (req, res, next) {
  const authHeader = req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token, authorization denied" });
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2) {
    return res.status(401).json({ message: "Token format invalid" });
  }

  const token = parts[1];

  if (!token || token === "null" || token === "undefined") {
    return res.status(401).json({ message: "Token is null or undefined" });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret");

    // Fetch full user from DB, excluding password
    const user = await User.findById(decoded.id || decoded._id).select(
      "-password"
    );

    if (!user) return res.status(401).json({ message: "User not found" });

    // Attach user to request
    req.user = user;

    // Optional: log role to verify
    console.log("User role:", user.role, "isAdmin:", user.isAdmin);

    next();
  } catch (err) {
    console.error("Auth Middleware Error:", err.message);
    return res.status(401).json({ message: "Token is not valid" });
  }
};
