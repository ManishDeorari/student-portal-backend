const User = require("../../../../models/User");
const https = require("https");

module.exports = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    
    // Check if the target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser || !targetUser.resume) {
      return res.status(404).json({ message: "Resume not found" });
    }

    const resumeUrl = targetUser.resume;

    // Fetch the PDF from Cloudinary using fetch API
    const response = await fetch(resumeUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "*/*"
      }
    });

    if (!response.ok) {
       console.error("Cloudinary returned:", response.status, response.statusText);
       const statusCode = response.status === 401 ? 502 : response.status;
       return res.status(statusCode).json({ message: "Error fetching resume from storage" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=resume.pdf");
    
    // Pipe response body to express response
    const { Readable } = require('stream');
    Readable.fromWeb(response.body).pipe(res);

  } catch (error) {
    console.error("getResumePdf Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
