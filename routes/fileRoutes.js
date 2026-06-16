const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const https = require("https");

// @route   GET /api/files/proxy
// @desc    Proxy Cloudinary file downloads securely
// @access  Private
router.get("/proxy", auth, async (req, res) => {
  try {
    const fileUrl = req.query.url;

    if (!fileUrl || typeof fileUrl !== 'string') {
      return res.status(400).json({ message: "File URL is required" });
    }

    // SSRF Protection: Ensure it only proxies Cloudinary URLs
    if (!fileUrl.startsWith("https://res.cloudinary.com/")) {
      return res.status(403).json({ message: "Invalid domain. Only Cloudinary URLs are allowed." });
    }

    https.get(fileUrl, (stream) => {
      if (stream.statusCode !== 200) {
         return res.status(stream.statusCode).json({ message: "Error fetching file from storage" });
      }

      // Pass content type along
      if (stream.headers["content-type"]) {
        res.setHeader("Content-Type", stream.headers["content-type"]);
      }
      
      const filename = req.query.name ? encodeURIComponent(req.query.name) : "document";
      res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
      
      stream.pipe(res);
    }).on("error", (err) => {
      console.error("Error proxying file:", err);
      res.status(500).json({ message: "Error fetching file" });
    });

  } catch (error) {
    console.error("Proxy Error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
