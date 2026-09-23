import type { SupportedLocale } from "../i18n/config.ts";
export type SummaryAttendanceChoice = { day: string | null; day_part?: string | null; choice: string | null };

export const ATTENDANCE_SUMMARY_COPY = {
  it: ["Giorni di presenza", "Mattina", "Pomeriggio", "Da comunicare"],
  en: ["Attendance days", "Morning", "Afternoon", "To be confirmed"],
  fr: ["Jours de présence", "Matin", "Après-midi", "À communiquer"],
  de: ["Anwesenheitstage", "Vormittag", "Nachmittag", "Noch mitzuteilen"],
  es: ["Días de asistencia", "Mañana", "Tarde", "Por comunicar"],
  nl: ["Aanwezigheidsdagen", "Ochtend", "Middag", "Nog door te geven"],
  uk: ["Дні присутності", "Ранок", "Друга половина дня", "Буде повідомлено"],
} satisfies Record<SupportedLocale, string[]>;

export function attendanceSummary(rows: SummaryAttendanceChoice[] | undefined, locale: SupportedLocale = "it"): string {
  if (!rows) return "—";
  const [, morning, afternoon, unknown] = ATTENDANCE_SUMMARY_COPY[locale];
  const days = new Map<string, Set<string>>();
  for (const row of rows) {
    if (row.choice !== "yes" || !row.day) continue;
    const parts = days.get(row.day) ?? new Set<string>();
    for (const part of row.day_part ? [row.day_part] : ["morning", "afternoon"]) parts.add(part);
    days.set(row.day, parts);
  }
  const format = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const result = [...days].sort(([a], [b]) => a.localeCompare(b)).map(([day, parts]) =>
    `${format.format(new Date(`${day}T12:00:00Z`))} (${[parts.has("morning") ? morning : "", parts.has("afternoon") ? afternoon : ""].filter(Boolean).join(", ")})`
  );
  if (!rows.length || rows.some(row => row.choice === "unknown")) result.push(unknown);
  return result.join("; ") || "—";
}
