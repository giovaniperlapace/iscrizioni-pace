// Keep international names readable while removing path and filename separators.
export function participantQrFilename(name: string): string {
  const safeName = Array.from(name.normalize("NFC")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, ""))
    .slice(0, 80).join("").replace(/-+$/g, "");
  return `qr-${safeName || "partecipante"}.png`;
}
