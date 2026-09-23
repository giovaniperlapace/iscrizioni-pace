import type { SupabaseClient } from "@supabase/supabase-js";
import type { AttendanceChoice } from "../groups/leader-attendance.ts";
import { loadRowsForIds } from "../supabase/all-rows.ts";

export async function loadAttendanceSummaries(db: SupabaseClient, registrationIds: string[]) {
  const { data } = await loadRowsForIds(registrationIds, (ids, from, to) => db
    .from("event_attendance_choices").select("registration_id,day,day_part,choice")
    .in("registration_id", ids).order("id").range(from, to));
  const result = new Map<string, AttendanceChoice[]>();
  for (const row of data) {
    const rows = result.get(row.registration_id) ?? [];
    rows.push(row as AttendanceChoice);
    result.set(row.registration_id, rows);
  }
  return result;
}
