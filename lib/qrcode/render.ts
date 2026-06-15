import QRCode from "qrcode";

const QR_DATA_URL_OPTIONS = {
  errorCorrectionLevel: "M" as const,
  margin: 2,
  scale: 8,
  type: "image/png" as const,
};

const QR_BUFFER_OPTIONS = {
  ...QR_DATA_URL_OPTIONS,
  type: "png" as const,
};

export async function renderQrPngBuffer(value: string): Promise<Buffer> {
  return QRCode.toBuffer(value, QR_BUFFER_OPTIONS);
}

export async function renderQrDataUrl(value: string): Promise<string> {
  return QRCode.toDataURL(value, QR_DATA_URL_OPTIONS);
}
