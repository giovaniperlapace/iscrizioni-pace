import { createHash, randomBytes } from "node:crypto";

export function createHomePreviewToken() {
  return randomBytes(32).toString("base64url");
}

export function hashHomePreviewToken(token: string): string | null {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return createHash("sha256").update(token).digest("hex");
}
