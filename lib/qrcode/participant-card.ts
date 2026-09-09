import path from "node:path";
import sharp from "sharp";
import QRCode from "qrcode";

export type QrParticipantIdentity = {
  first_name: string;
  last_name: string;
  public_code: string | null;
};

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Visible identity belongs to the card, never to the opaque QR payload.
// Used for named downloads; future wallet/print layouts must retain it.
export async function renderParticipantQrPng(
  token: string,
  participant: QrParticipantIdentity,
): Promise<Buffer> {
  const name = `${participant.first_name} ${participant.last_name}`.replace(/\s+/g, " ").trim();
  if (!name) throw new Error("QR participant name missing");
  const width = 640;
  const text = await sharp({
    text: {
      text: escapeText(name) + (participant.public_code ? `\n<span size="24576">${escapeText(participant.public_code)}</span>` : ""),
      font: "Noto Sans 32",
      fontfile: path.join(process.cwd(), "lib/qrcode/fonts/NotoSans-Regular.ttf"),
      width: width - 64,
      align: "centre",
      wrap: "word-char",
      spacing: 12,
      rgba: true,
    },
  }).png().toBuffer({ resolveWithObject: true });
  const qr = await QRCode.toBuffer(token, {
    errorCorrectionLevel: "M", margin: 4, scale: 12, type: "png",
  });
  // Integer modules and a four-module quiet zone, without resampling.
  const { width: qrWidth = 0, height: qrHeight = 0 } = await sharp(qr).metadata();
  const cardWidth = Math.max(width, qrWidth + 32);
  return sharp({ create: {
    width: cardWidth, height: qrHeight + text.info.height + 80,
    channels: 3, background: "white",
  } }).composite([
    { input: qr, left: Math.floor((cardWidth - qrWidth) / 2), top: 16 },
    { input: text.data, left: Math.floor((cardWidth - text.info.width) / 2), top: qrHeight + 32 },
  ]).png().toBuffer();
}

export async function renderParticipantQrDataUrl(token: string, participant: QrParticipantIdentity): Promise<string> {
  return `data:image/png;base64,${(await renderParticipantQrPng(token, participant)).toString("base64")}`;
}
