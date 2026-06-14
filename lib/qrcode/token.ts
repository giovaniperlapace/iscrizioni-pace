import { createHash, randomBytes } from "node:crypto";

export type QrToken = {
  token: string;
  tokenHash: string;
};

export function createOpaqueQrToken(): QrToken {
  const token = randomBytes(32).toString("base64url");

  return {
    token,
    tokenHash: hashQrToken(token),
  };
}

export function hashQrToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
