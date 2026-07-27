import nodemailer, { type Transporter } from "nodemailer";

import { getEmailConfig, type EmailConfig } from "./config";

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
    cid?: string;
  }>;
};

let smtpTransporter: Transporter | null = null;
let smtpTransporterConfig: EmailConfig | null = null;

export async function sendTransactionalEmail(input: SendEmailInput) {
  const config = getEmailConfig();

  if (config.deliveryMode === "log") {
    console.info("[email:log]", {
      to: input.to,
      from: config.from,
      subject: input.subject,
      text: input.text,
      attachments: input.attachments?.map((attachment) => ({
        filename: attachment.filename,
        contentType: attachment.contentType,
        cid: attachment.cid,
        size: attachment.content.length,
      })),
    });

    return {
      messageId: `log-${Date.now()}`,
    };
  }

  const transporter = getSmtpTransporter(config);

  return transporter.sendMail({
    from: config.from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    attachments: input.attachments,
  });
}

export function closeEmailTransport(): void {
  smtpTransporter?.close();
  smtpTransporter = null;
  smtpTransporterConfig = null;
}

function getSmtpTransporter(config: EmailConfig): Transporter {
  if (
    smtpTransporter &&
    smtpTransporterConfig &&
    hasSameTransportConfiguration(smtpTransporterConfig, config)
  ) {
    return smtpTransporter;
  }

  closeEmailTransport();
  smtpTransporter = config.pool
    ? nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        pool: true,
        maxConnections: config.maxConnections,
        maxMessages: config.maxMessages,
        auth: {
          user: config.user,
          pass: config.password,
        },
      })
    : nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.user,
          pass: config.password,
        },
      });
  smtpTransporterConfig = config;

  return smtpTransporter;
}

function hasSameTransportConfiguration(
  previous: EmailConfig,
  current: EmailConfig
): boolean {
  return (
    previous.host === current.host &&
    previous.port === current.port &&
    previous.secure === current.secure &&
    previous.user === current.user &&
    previous.password === current.password &&
    previous.pool === current.pool &&
    previous.maxConnections === current.maxConnections &&
    previous.maxMessages === current.maxMessages
  );
}
