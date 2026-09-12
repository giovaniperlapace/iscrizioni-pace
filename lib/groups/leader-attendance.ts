import { ATTENDANCE_PARTS, buildAllowedAttendanceSlotKeys, encodeAttendanceSlot, parseAttendanceSlot } from "../registrations/attendance-slots.ts";

export type AttendanceChoice = { day: string | null; day_part: "morning" | "afternoon" | null; choice: string };
export function leaderAttendanceDefaults(rows: AttendanceChoice[]) {
  const slots = [...new Set(rows.filter(row => row.day && row.choice === "yes").flatMap(row =>
    (row.day_part ? [row.day_part] : ATTENDANCE_PARTS.map(part => part.value))
      .map(part => encodeAttendanceSlot({ day: row.day!, part }))
  ))];
  return { slots, unknown: rows.some(row => row.choice === "unknown") || rows.length === 0 };
}

export function parseLeaderAttendance(form: FormData, startsOn: string | null, endsOn: string | null) {
  if (form.get("availabilityUnknown") === "on") return { unknown: true, slots: [] };
  const allowed = buildAllowedAttendanceSlotKeys(startsOn, endsOn);
  const values = [...new Set(form.getAll("availabilitySlots"))];
  if (!values.length || values.some(value => typeof value !== "string" || !allowed.has(value))) return null;
  return { unknown: false, slots: values.map(value => parseAttendanceSlot(value as string)!) };
}
