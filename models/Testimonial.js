const mongoose = require("mongoose");

const testimonialSchema = new mongoose.Schema(
  {
    quote: {
      type: String,
      required: true,
    },
    authorName: {
      type: String,
      required: true,
    },
    authorDetail: {
      type: String, // e.g., "MCA - 2024-26" or "Software Engineer at Google"
    },
    isFeatured: {
      type: Boolean,
      default: true,
    },
    portal: {
      type: String,
      enum: ["Student", "Alumni"],
      default: "Student",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Testimonial", testimonialSchema);
