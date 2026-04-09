const connectDB = require("../../../config/db");
const Event = require("../../../models/Event");

connectDB();

export async function GET(req, res) {
  try {
    const events = await Event.find();
    return res.json(events);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching events" });
  }
}

export async function POST(req, res) {
  try {
    const { title, date, location, description } = req.body;
    const event = new Event({ title, date, location, description });

    await event.save();
    return res.status(201).json({ message: "Event created successfully!" });
  } catch (error) {
    return res.status(500).json({ message: "Error creating event" });
  }
}
