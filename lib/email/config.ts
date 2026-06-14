export const DEFAULT_EMAIL_FROM = "registrationspeace@gmail.com";

export type EmailConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
  deliveryMode: "smtp" | "log";
};

export function getEmailConfig(): EmailConfig {
  const deliveryMode = process.env.EMAIL_DELIVERY_MODE === "log" ? "log" : "smtp";
  const user =
    process.env.EMAIL_USER ||
    process.env.SMTP_USER ||
    process.env.GMAIL_USER ||
    DEFAULT_EMAIL_FROM;
  const password =
    process.env.EMAIL_PASSWORD ||
    process.env.SMTP_PASSWORD ||
    process.env.GMAIL_APP_PASSWORD;

  if (!password && deliveryMode === "smtp") {
    throw new Error("Missing EMAIL_PASSWORD/SMTP_PASSWORD/GMAIL_APP_PASSWORD");
  }

  return {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE
      ? process.env.SMTP_SECURE === "true"
      : true,
    user,
    password: password?.replace(/\s+/g, "") ?? "",
    from: process.env.EMAIL_FROM || user,
    deliveryMode,
  };
}
