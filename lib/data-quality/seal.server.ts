import { decryptQrToken, encryptQrToken } from "../qrcode/secure-token.ts";
export function qualityExpiry(): number {
  return Date.now() + 20 * 60_000;
}
export function sealQualityPayload(value: unknown): string {
  return encryptQrToken(JSON.stringify(value));
}
export function openQualityPayload<
  T extends { kind: string; actor: string; eventId: string; expires: number },
>(token: unknown, kind: string, actor: string, eventId: string): T {
  if (typeof token !== "string" || token.length > 2_500_000)
    throw new Error("Anteprima non valida.");
  const decrypted = decryptQrToken(token);
  const value = decrypted ? (JSON.parse(decrypted) as T) : null;
  if (
    !value ||
    value.kind !== kind ||
    value.actor !== actor ||
    value.eventId !== eventId ||
    value.expires < Date.now()
  )
    throw new Error("Anteprima scaduta o non valida. Generala nuovamente.");
  return value;
}
