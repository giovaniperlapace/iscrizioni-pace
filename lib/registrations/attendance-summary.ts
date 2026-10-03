import { buildAttendanceDayColumns, ATTENDANCE_PARTS, type AttendanceSlot } from "./attendance-slots.ts";
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

export type AttendanceTableColumn = AttendanceSlot & { key: string; label: string };
const ATTENDANCE_BOOLEAN_COPY = {
  it: ["Sì", "No"], en: ["Yes", "No"], fr: ["Oui", "Non"],
  de: ["Ja", "Nein"], es: ["Sí", "No"], nl: ["Ja", "Nee"], uk: ["Так", "Ні"],
} satisfies Record<SupportedLocale, string[]>;

export function attendanceTableColumns(startsOn: string | null, endsOn: string | null, locale: SupportedLocale = "it"): AttendanceTableColumn[] {
  return buildAttendanceDayColumns(startsOn, endsOn, locale).flatMap(day => day.parts.map(part => ({
    day: day.day, part, key: `${day.day}__${part}`,
    label: `${day.label} · ${ATTENDANCE_PARTS.find(item => item.value === part)!.label[locale]}`,
  })));
}

export function attendanceSlotText(rows: SummaryAttendanceChoice[] | undefined, slot: AttendanceSlot, locale: SupportedLocale = "it"): string {
  if (!rows) return "—";
  const match = rows.filter(row => row.day === slot.day && (!row.day_part || row.day_part === slot.part));
  if (match.some(row => row.choice === "yes")) return ATTENDANCE_BOOLEAN_COPY[locale][0];
  if (!rows.length || rows.some(row => row.choice === "unknown")) return ATTENDANCE_SUMMARY_COPY[locale][3];
  return ATTENDANCE_BOOLEAN_COPY[locale][1];
}
