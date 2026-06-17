import { createHash, randomBytes } from "node:crypto";

export const GROUP_REGISTRATION_LINK_QUERY_PARAM = "groupLink";
export const GROUP_REGISTRATION_LINK_TOKEN_BYTES = 24;
export const GROUP_REGISTRATION_LINK_TOKEN_PATTERN = /^[A-Za-z0-9_-]{24,96}$/;

export type GroupRegistrationLinkStatus =
  | "active"
  | "expired"
  | "revoked"
  | "exhausted";

export type GroupRegistrationLinkStateInput = {
  expiresAt: string | null;
  revokedAt: string | null;
  maxUses: number | null;
  useCount: number | null;
  now?: Date;
};

export function createGroupRegistrationLinkToken(): string {
  return randomBytes(GROUP_REGISTRATION_LINK_TOKEN_BYTES).toString("base64url");
}

export function hashGroupRegistrationLinkToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isValidGroupRegistrationLinkToken(token: string | null): boolean {
  return Boolean(token && GROUP_REGISTRATION_LINK_TOKEN_PATTERN.test(token));
}

export function normalizeGroupRegistrationPublicLabel(
  value: FormDataEntryValue | string | null
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, " ");

  return normalized.length > 0 ? normalized.slice(0, 120) : null;
}

export function getGroupRegistrationDisplayLabel({
  linkPublicLabel,
  groupPublicLabel,
}: {
  linkPublicLabel: string | null;
  groupPublicLabel: string | null;
}): string {
  return (
    normalizeGroupRegistrationPublicLabel(linkPublicLabel) ??
    normalizeGroupRegistrationPublicLabel(groupPublicLabel) ??
    "Gruppo indicato dal tuo referente"
  );
}

export function buildGroupRegistrationUrl({
  appUrl,
  token,
  email,
}: {
  appUrl: string;
  token: string;
  email?: string | null;
}): string {
  const url = new URL("/registrazione", appUrl.replace(/\/$/, ""));
  url.searchParams.set(GROUP_REGISTRATION_LINK_QUERY_PARAM, token);

  if (email) {
    url.searchParams.set("email", email);
  }

  return url.toString();
}

export function getGroupRegistrationLinkStatus(
  input: GroupRegistrationLinkStateInput
): GroupRegistrationLinkStatus {
  if (input.revokedAt) {
    return "revoked";
  }

  if (input.expiresAt && new Date(input.expiresAt).getTime() < (input.now ?? new Date()).getTime()) {
    return "expired";
  }

  if (
    input.maxUses !== null &&
    input.maxUses > 0 &&
    (input.useCount ?? 0) >= input.maxUses
  ) {
    return "exhausted";
  }

  return "active";
}
