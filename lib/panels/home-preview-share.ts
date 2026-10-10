import { createHash, timingSafeEqual } from "node:crypto";

export function isHomeApprovalTokenValid(token: string, configuration: string | undefined, now: number): boolean {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token) || !configuration) return false;
  try {
    const { hash, expiresAt } = JSON.parse(configuration) as { hash: string; expiresAt: string };
    if (!/^[a-f0-9]{64}$/.test(hash) || !Number.isFinite(Date.parse(expiresAt)) || now >= Date.parse(expiresAt)) return false;
    return timingSafeEqual(createHash("sha256").update(token).digest(), Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}
