const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail', // ✅ Using gmail service helper
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // true for 465
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // ✅ 16-character App Password
    },
  });

  const mailOptions = {
    from: `"TripMate" <${process.env.EMAIL_USER}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html,
  };

  return await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;