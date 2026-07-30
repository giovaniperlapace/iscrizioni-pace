import { createHash } from "node:crypto";

export const GROUP_REGISTRATION_LINK_QUERY_PARAM = "groupLink";
export const GROUP_REGISTRATION_LINK_TOKEN_MAX_LENGTH = 96;
export const GROUP_REGISTRATION_LINK_TOKEN_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9_-]{2,95}$/;
export const GROUP_REGISTRATION_LINK_RESERVED_TOKENS = new Set([
  "api",
  "auth",
  "dashboard",
  "login",
  "registrazione",
]);

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

export function normalizeGroupRegistrationLinkTokenSlug(value: string): string {
  const asciiValue = value
    .replace(/ß/g, "ss")
    .replace(/æ/g, "ae")
    .replace(/œ/g, "oe")
    .replace(/[łŁ]/g, "l")
    .replace(/[đĐðÐ]/g, "d")
    .replace(/[þÞ]/g, "th")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
  const slug = asciiValue
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, GROUP_REGISTRATION_LINK_TOKEN_MAX_LENGTH)
    .replace(/_+$/g, "");

  if (slug.length >= 3) {
    return slug;
  }

  return slug ? `gruppo_${slug}` : "gruppo";
}

export function createGroupRegistrationLinkToken(
  publicLabel: string,
  sequence = 1
): string {
  const normalizedSequence = Math.max(1, Math.trunc(sequence));
  const suffix = normalizedSequence > 1 ? `_${normalizedSequence}` : "";
  const base = normalizeGroupRegistrationLinkTokenSlug(publicLabel)
    .slice(0, GROUP_REGISTRATION_LINK_TOKEN_MAX_LENGTH - suffix.length)
    .replace(/_+$/g, "");

  return `${base}${suffix}`;
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
  const url = new URL(
    buildGroupRegistrationPath({ token, email }),
    appUrl.replace(/\/$/, "")
  );

  return url.toString();
}

export function buildGroupRegistrationPath({
  token,
  email,
  error,
}: {
  token: string;
  email?: string | null;
  error?: string | null;
}): string {
  const path = `/${encodeURIComponent(token)}`;
  const searchParams = new URLSearchParams();

  if (email) {
    searchParams.set("email", email);
  }

  if (error) {
    searchParams.set("error", error);
  }

  const query = searchParams.toString();

  return query ? `${path}?${query}` : path;
}

export function isReservedGroupRegistrationLinkToken(token: string): boolean {
  return GROUP_REGISTRATION_LINK_RESERVED_TOKENS.has(token.toLowerCase());
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
