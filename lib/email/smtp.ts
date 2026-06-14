import nodemailer from "nodemailer";

import { getEmailConfig } from "./config";

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export async function sendTransactionalEmail(input: SendEmailInput) {
  const config = getEmailConfig();
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password,
    },
  });

  return transporter.sendMail({
    from: config.from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}
