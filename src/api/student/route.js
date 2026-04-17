const connectDB = require("../../../config/db");
const Student = require("../../../models/Student");

connectDB();

export async function GET() {
  try {
    const student = await Student.find();
    return res.json(student);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching student data" });
  }
}

export async function POST(req) {
  try {
    const { name, year, job } = await req.json();
    const newStudent = new Student({ name, year, job });

    await newStudent.save();
    return res.status(201).json({ message: "Student added successfully!" });
  } catch (error) {
    return res.status(500).json({ message: "Error adding student" });
  }
}
