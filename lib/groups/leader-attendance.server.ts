import type { SupabaseClient } from "@supabase/supabase-js";
import { collectDescendantGroupIds } from "./capogruppo-dashboard.ts";
import { loadLeaderScope } from "./leader-data.server.ts";
import { leaderAttendanceDefaults, type AttendanceChoice } from "./leader-attendance.ts";

// Authenticated user and current event are supplied by the server, never the form.
export async function loadLeaderAttendance(db: SupabaseClient, userId: string, eventId: string, assignmentId: string) {
  const { activeGroupRows, rootGroupIds } = await loadLeaderScope(db, userId, eventId);
  const activeIds = new Set(activeGroupRows.map(group => group.id));
  const scopedGroupIds = collectDescendantGroupIds(
    activeGroupRows.map(group => ({ id: group.id, parentGroupId: group.parent_group_id })),
    rootGroupIds.filter(id => activeIds.has(id)),
  );
  if (!scopedGroupIds.size) return null;
  const { data, error } = await db.from("participant_group_assignments")
    .select("group_id,registration_id,registrations!inner(event_id,deleted_at)")
    .eq("id", assignmentId).eq("is_current", true)
    .eq("registrations.event_id", eventId).is("registrations.deleted_at", null).maybeSingle();
  if (error) throw new Error("Attendance assignment read failed");
  if (!data || !scopedGroupIds.has(data.group_id)) return null;
  const [event, attendance] = await Promise.all([
    db.from("events").select("starts_on,ends_on").eq("id", eventId).eq("is_current", true).single(),
    db.from("event_attendance_choices").select("day,day_part,choice").eq("registration_id", data.registration_id),
  ]);
  if (event.error || attendance.error) throw new Error("Attendance read failed");
  return { ...leaderAttendanceDefaults(attendance.data as AttendanceChoice[]), startsOn: event.data.starts_on as string | null, endsOn: event.data.ends_on as string | null };
}
