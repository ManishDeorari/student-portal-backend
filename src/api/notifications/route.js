const connectDB = require("../../../config/db");
const Notification = require("../../../models/Notification");

connectDB();

export async function GET() {
  try {
    const notifications = await Notification.find();
    return res.json(notifications);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching notifications" });
  }
}

export async function POST(req) {
  try {
    const { message, userId } = await req.json();
    const newNotification = new Notification({ message, userId });

    await newNotification.save();
    return res.status(201).json({ message: "Notification added!" });
  } catch (error) {
    return res.status(500).json({ message: "Error adding notification" });
  }
}
