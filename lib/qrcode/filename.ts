// Keep international names readable while removing path and filename separators.
function safeQrName(name: string): string {
  return Array.from(name.normalize("NFC")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, ""))
    .slice(0, 80).join("").replace(/-+$/g, "");
}

export function participantQrFilename(name: string): string {
  return `qr-${safeQrName(name) || "partecipante"}.png`;
}

export function groupQrFilename(name: string): string {
  return `qr-gruppo-${safeQrName(name) || "gruppo"}.png`;
}
