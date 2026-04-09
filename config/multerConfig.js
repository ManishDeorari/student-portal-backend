const multer = require("multer");
const path = require("path");

// Define storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads"); // Folder where the files will be stored
  },
  filename: (req, file, cb) => {
    // Use a timestamp as filename to avoid collisions
    const fileExtension = path.extname(file.originalname); // Get file extension
    const fileName = `${Date.now()}${fileExtension}`; // Unique file name based on timestamp
    cb(null, fileName); // Save the file with the unique name
  },
});

// Create the upload instance
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Limit file size to 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "video/mp4"];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Invalid file type. Only images and videos are allowed."));
    }
    cb(null, true);
  },
});

module.exports = upload;
