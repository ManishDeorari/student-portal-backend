const connectDB = require("../../../config/db");
const Alumni = require("../../../models/Alumni");

connectDB();

export async function GET() {
  try {
    const alumni = await Alumni.find();
    return res.json(alumni);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching alumni data" });
  }
}

export async function POST(req) {
  try {
    const { name, year, job } = await req.json();
    const newAlumni = new Alumni({ name, year, job });

    await newAlumni.save();
    return res.status(201).json({ message: "Alumni added successfully!" });
  } catch (error) {
    return res.status(500).json({ message: "Error adding alumni" });
  }
}
