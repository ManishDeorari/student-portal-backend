const nodemailer = require("nodemailer");

async function test() {
  console.log("Testing with port 587 and secure: false...");
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: "manishdeorari377@gmail.com",
        pass: "xtlobiazyghslloq",
      }
    });

    await transporter.verify();
    console.log("SUCCESS: Port 587 connected and authenticated.");
  } catch (err) {
    console.error("FAIL: Port 587 error:", err.message);
  }

  console.log("\nTesting with port 465 and secure: true...");
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: "manishdeorari377@gmail.com",
        pass: "xtlobiazyghslloq",
      }
    });

    await transporter.verify();
    console.log("SUCCESS: Port 465 connected and authenticated.");
  } catch (err) {
    console.error("FAIL: Port 465 error:", err.message);
  }
}

test();
