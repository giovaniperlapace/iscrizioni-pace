import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export function encryptQrToken(token: string): string {
  const iv = randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptQrToken(encryptedToken: string | null | undefined): string | null {
  if (!encryptedToken) {
    return null;
  }

  const [version, ivValue, authTagValue, encryptedValue] = encryptedToken.split(".");

  if (version !== "v1" || !ivValue || !authTagValue || !encryptedValue) {
    return null;
  }

  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      getEncryptionKey(),
      Buffer.from(ivValue, "base64url"),
      { authTagLength: AUTH_TAG_LENGTH }
    );

    decipher.setAuthTag(Buffer.from(authTagValue, "base64url"));

    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

function getEncryptionKey(): Buffer {
  const secret =
    process.env.QR_TOKEN_ENCRYPTION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.EMAIL_PASSWORD;

  if (!secret) {
    throw new Error(
      "QR_TOKEN_ENCRYPTION_SECRET is required to store retrievable QR tokens."
    );
  }

  return createHash("sha256").update(secret, "utf8").digest();
}
