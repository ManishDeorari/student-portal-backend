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

    // Fetch the PDF from Cloudinary and stream it to the client
    https.get(resumeUrl, (stream) => {
      if (stream.statusCode !== 200) {
         return res.status(stream.statusCode).json({ message: "Error fetching resume from storage" });
      }

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "inline; filename=resume.pdf");
      
      stream.pipe(res);
    }).on("error", (err) => {
      console.error("Error streaming resume:", err);
      res.status(500).json({ message: "Error fetching resume" });
    });

  } catch (error) {
    console.error("getResumePdf Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
