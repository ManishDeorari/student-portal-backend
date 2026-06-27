
const mongoose = require("mongoose");
const User = require("./models/User");
require("dotenv").config();

async function checkDuplicates() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB.");

    const duplicates = await User.aggregate([
      {
        $project: {
          emailLower: { $toLower: "$email" },
          originalEmail: "$email",
          name: 1,
          role: 1
        }
      },
      {
        $group: {
          _id: "$emailLower",
          count: { $sum: 1 },
          accounts: { $push: { email: "$originalEmail", name: "$name", id: "$_id", role: "$role" } }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);

    if (duplicates.length === 0) {
      console.log("No duplicate emails found.");
    } else {
      console.log(`Found ${duplicates.length} email(s) with multiple accounts:\n`);
      duplicates.forEach(dup => {
        console.log(`Email: ${dup._id} (${dup.count} accounts)`);
        dup.accounts.forEach(acc => {
          console.log(` - ID: ${acc.id} | Email used: ${acc.email} | Name: ${acc.name} | Role: ${acc.role}`);
        });
        console.log("-----------------------------------------");
      });
    }
    mongoose.connection.close();
  } catch (err) {
    console.error("Error:", err);
    mongoose.connection.close();
  }
}

checkDuplicates();

