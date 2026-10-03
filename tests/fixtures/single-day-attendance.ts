import { buildEventStatisticsSnapshot, type StatisticsAttendanceChoice } from "../../lib/registrations/event-statistics.ts";

const ids = ["family", "morning", "legacy", "arrival", "multiple", "missing", "unknown", "mixed-unknown", "no", "outside"];
export const singleDayParticipants = ids.map(registrationId => ({
  registrationId, eventId: "event", eventTitle: "Evento sintetico", name: `Prova ${registrationId}`,
  currentGroupId: null, currentGroupName: null, country: null, city: null,
  children: registrationId === "family" ? [{ id: "child", firstName: "Figlio", lastName: "Prova", birthDate: "2020-01-01", position: 1 }] : [],
}));
const yes = (registration_id: string, day: string, day_part: string | null = "morning"): StatisticsAttendanceChoice => ({ registration_id, day, day_part, choice: "yes" });
export const singleDayChoices: StatisticsAttendanceChoice[] = [
  yes("family", "2026-10-25"), yes("family", "2026-10-25", "afternoon"), yes("family", "2026-10-25"),
  yes("morning", "2026-10-25"), yes("legacy", "2026-10-26", null), yes("arrival", "2026-10-24", "afternoon"),
  yes("multiple", "2026-10-25"), yes("multiple", "2026-10-26"),
  { registration_id: "unknown", day: null, choice: "unknown" },
  yes("mixed-unknown", "2026-10-25"), { registration_id: "mixed-unknown", day: null, choice: "unknown" },
  { registration_id: "no", day: "2026-10-25", day_part: "morning", choice: "no" },
  yes("outside", "2026-10-28"),
];
export const singleDayStatistics = buildEventStatisticsSnapshot({
  participants: singleDayParticipants, groups: [], attendanceChoices: singleDayChoices,
  eventStartsOn: "2026-10-25", eventEndsOn: "2026-10-27",
});
