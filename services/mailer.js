const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
const path = require("path");

// Load environment variables from config.env file
dotenv.config({ path: path.resolve(__dirname, "../config.env") });

// Log environment variables to verify they are loaded correctly
console.log('SMTP Host:', process.env.SMTP_HOST);
console.log('SMTP Port:', process.env.SMTP_PORT);
console.log('SMTP User:', process.env.SMTP_USER);
console.log('SMTP Password:', process.env.SMTP_PASSWORD ? 'Loaded' : 'Not Loaded');

// Create a transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com', // Sử dụng 'smtp.gmail.com' nếu không có giá trị trong file .env
    port: parseInt(process.env.SMTP_PORT, 10) || 465, // Chuyển sang số nguyên và dùng cổng 465 nếu không có giá trị trong file .env
    secure: parseInt(process.env.SMTP_PORT, 10) === 465, // true nếu cổng là 465, dùng SSL/TLS
    auth: {
        user: process.env.SMTP_USER, // Email tài khoản Gmail
        pass: process.env.SMTP_PASSWORD, // Mật khẩu hoặc Mật khẩu ứng dụng
    },
});

// Function to send email
const sendEmail = async ({ to, subject, html, text, attachments }) => {
    try {
        // Define email options
        const mailOptions = {
            from: process.env.SMTP_USER, // Sender email address
            to, // Recipient email address
            subject, // Email subject
            text, // Plain text body (optional)
            html, // HTML body (optional)
            attachments, // Attachments (optional)
        };

        // Send email
        let info = await transporter.sendMail(mailOptions);
        console.log(`Email sent successfully: ${info.messageId}`);
    } catch (error) {
        // Catch any errors and display them
        console.error("Error sending email:", error.message);
        if (error.code === 'EAUTH') {
            console.error("Authentication failed. Please check the SMTP user and password.");
        } else if (error.code === 'ESOCKET') {
            console.error("Connection error. Check the SMTP host and port configuration.");
        } else if (error.responseCode === 535) {
            console.error("Invalid login credentials. Please ensure you're using the correct SMTP user and password.");
        } else {
            console.error("Unknown error occurred:", error);
        }
    }
};

// Export sendEmail function for use in other parts of the application
exports.sendEmail = async (args) => {
    // If in development mode, skip sending email
    if (process.env.NODE_ENV === "development") {
        console.log("Email sending skipped in development mode.");
        return Promise.resolve();
    } else {
        return sendEmail(args);
    }
};
