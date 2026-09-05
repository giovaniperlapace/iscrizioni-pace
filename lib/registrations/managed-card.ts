import type { SupportedLocale } from "../i18n/config.ts";
import { MANAGED_PARTICIPANT_COPY } from "./managed-participant-copy.ts";
export type ManagedCardData = {
  qr: { status: string; expires_at: string | null; token_encrypted: string | null } | null;
  attendance: Array<{ day: string | null; day_part: string | null; choice: string }>;
  responsibility: { responsible_user_id: string | null; delivery_mode: string; name: string | null; email: string | null; valid: boolean } | null;
};
export function isRegistrationQrActive(qr: Pick<NonNullable<ManagedCardData["qr"]>, "status" | "expires_at"> | null, status: string | null, now = Date.now()) {
  return status !== "cancelled" && qr?.status === "active" && (!qr.expires_at || Date.parse(qr.expires_at) > now);
}
export function formatManagedAttendance(rows: ManagedCardData["attendance"], locale: SupportedLocale) {
  const copy = MANAGED_PARTICIPANT_COPY[locale];
  const slots = new Set(rows.filter((row) => row.day && row.choice === "yes").flatMap((row) => {
    const day = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${row.day}T12:00:00Z`));
    return (row.day_part === "morning" ? [copy.morning] : row.day_part === "afternoon" ? [copy.afternoon] : [copy.morning, copy.afternoon]).map((part) => `${day}: ${part}`);
  }));
  return [...slots].join(" · ") || copy.unknown;
}
