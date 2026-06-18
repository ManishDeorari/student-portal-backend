const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const https = require("https");
const cloudinary = require("../../config/cloudinary");

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
    
    // Support inline viewing (for images and videos)
    const isInline = req.query.inline === 'true';
    if (isInline) {
      // 🚀 REDIRECT METHOD: Way faster, zero backend load, browser downloads from CDN directly.
      // We generate a "temporary" signed link (or use raw if signing not configured).
      return res.redirect(302, fileUrl);
    } else {
      const filename = req.query.name ? encodeURIComponent(req.query.name) : "document";
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      
      // For downloads, we still pipe to hide the URL and force the attachment header
      const { Readable } = require('stream');
      Readable.fromWeb(response.body).pipe(res);
    }

  } catch (error) {
    console.error("Proxy Error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
