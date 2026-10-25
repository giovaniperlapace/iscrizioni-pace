export const FORUM_EXPORT_SESSIONS = [
  { key: "lunedi-mattina", label: "Lunedì mattina", weekday: "Mon", period: "morning" },
  { key: "lunedi-pomeriggio", label: "Lunedì pomeriggio", weekday: "Mon", period: "afternoon" },
  { key: "martedi-mattina", label: "Martedì mattina", weekday: "Tue", period: "morning" },
] as const;
export function forumExportSession(startsAt: string | null): string | null {
  if (!startsAt || !Number.isFinite(Date.parse(startsAt))) return null;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", weekday: "short", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date(startsAt));
  const weekday = parts.find(p => p.type === "weekday")?.value;
  const period = Number(parts.find(p => p.type === "hour")?.value) < 12 ? "morning" : "afternoon";
  return FORUM_EXPORT_SESSIONS.find(s => s.weekday === weekday && s.period === period)?.key ?? null;
}
