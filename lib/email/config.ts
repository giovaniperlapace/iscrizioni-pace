export const DEFAULT_EMAIL_FROM = "registrationspeace@gmail.com";

export type EmailConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
};

export function getEmailConfig(): EmailConfig {
  const user =
    process.env.EMAIL_USER ||
    process.env.SMTP_USER ||
    process.env.GMAIL_USER ||
    DEFAULT_EMAIL_FROM;
  const password =
    process.env.EMAIL_PASSWORD ||
    process.env.SMTP_PASSWORD ||
    process.env.GMAIL_APP_PASSWORD;

  if (!password) {
    throw new Error("Missing EMAIL_PASSWORD/SMTP_PASSWORD/GMAIL_APP_PASSWORD");
  }

  return {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE
      ? process.env.SMTP_SECURE === "true"
      : true,
    user,
    password,
    from: process.env.EMAIL_FROM || user,
  };
}
