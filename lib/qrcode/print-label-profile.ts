// Profiles describe documents, never configure Chrome or the printer.
export const QR_LABEL_PROFILES = {
  "die-cut-29x90": { height: 90, codeTop: 40 },
  "continuous-29x45": { height: 45, codeTop: 39 },
} as const;
export type QrLabelProfile = keyof typeof QR_LABEL_PROFILES;
export function isQrLabelProfile(value: unknown): value is QrLabelProfile {
  return typeof value === "string" && Object.hasOwn(QR_LABEL_PROFILES, value);
}
