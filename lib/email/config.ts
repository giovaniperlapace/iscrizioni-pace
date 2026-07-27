export const DEFAULT_EMAIL_FROM = "registrationspeace@santegidio.org";

export type EmailConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
  deliveryMode: "smtp" | "log";
  pool: boolean;
  maxConnections: number;
  maxMessages: number;
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
    pool: parseBoolean(process.env.SMTP_POOL, true),
    maxConnections: parseBoundedInteger(
      process.env.SMTP_MAX_CONNECTIONS,
      5,
      1,
      10
    ),
    maxMessages: parseBoundedInteger(
      process.env.SMTP_MAX_MESSAGES,
      100,
      1,
      1_000
    ),
  };
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return fallback;
}

function parseBoundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
}
