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

    // Fetch the PDF from Cloudinary using fetch API
    const response = await fetch(fileUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "*/*"
      }
    });

    if (!response.ok) {
       console.error("Cloudinary returned:", response.status, response.statusText);
       const statusCode = response.status === 401 ? 502 : response.status;
       return res.status(statusCode).json({ message: "Error fetching file from storage" });
    }

    // Pass content type along
    const contentType = response.headers.get("content-type");
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }
    
    const filename = req.query.name ? encodeURIComponent(req.query.name) : "document";
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    
    // Pipe response body to express response
    const { Readable } = require('stream');
    Readable.fromWeb(response.body).pipe(res);

  } catch (error) {
    console.error("Proxy Error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
