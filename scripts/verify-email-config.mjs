import nodemailer from "nodemailer";

const user =
  process.env.EMAIL_USER ||
  process.env.SMTP_USER ||
  process.env.GMAIL_USER ||
  process.env.EMAIL_FROM ||
  "registrationspeace@santegidio.org";
const password =
  process.env.EMAIL_PASSWORD ||
  process.env.SMTP_PASSWORD ||
  process.env.GMAIL_APP_PASSWORD;

if (!password) {
  console.error("Missing EMAIL_PASSWORD/SMTP_PASSWORD/GMAIL_APP_PASSWORD");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT || 465),
  secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : true,
  auth: {
    user,
    pass: password.replace(/\s+/g, ""),
  },
});

try {
  await transporter.verify();
  console.log("Email SMTP configuration verified.");
} catch (error) {
  const code = error?.code ? ` ${error.code}` : "";
  const responseCode = error?.responseCode ? ` ${error.responseCode}` : "";
  console.error(`Email SMTP verification failed.${code}${responseCode}`);
  process.exit(1);
}
