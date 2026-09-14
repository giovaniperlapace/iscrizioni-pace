import type { SupabaseClient } from "@supabase/supabase-js";
import { leaderAttendanceDefaults, type AttendanceChoice } from "../groups/leader-attendance.ts";

export async function loadOperationsAttendance(db: SupabaseClient, registrationId: string, canManageEvent: (eventId: string) => boolean) {
  const registration = await db.from("registrations").select("event_id,deleted_at").eq("id", registrationId).maybeSingle();
  if (registration.error) throw new Error("Attendance registration read failed");
  if (!registration.data || registration.data.deleted_at || !canManageEvent(registration.data.event_id)) return null;
  const [event, attendance] = await Promise.all([
    db.from("events").select("starts_on,ends_on").eq("id", registration.data.event_id).single(),
    db.from("event_attendance_choices").select("day,day_part,choice").eq("registration_id", registrationId),
  ]);
  if (event.error || attendance.error) throw new Error("Attendance read failed");
  return { ...leaderAttendanceDefaults(attendance.data as AttendanceChoice[]), startsOn: event.data.starts_on as string | null, endsOn: event.data.ends_on as string | null };
}
