import type { SupabaseClient } from "@supabase/supabase-js";

export type AttendanceSnapshot = {
  eventId: string;
  updatedAt: string;
  totals: { adults: number; children: number; students: number; companions: number; schoolBookings: number; people: number };
  entries: Record<string, string>;
  schoolEntries: Record<string, { checkedInAt: string; students: number; companions: number }>;
};
export class AttendanceReadError extends Error {
  status: number;
  constructor(status: number) { super("Presenze non disponibili"); this.status = status; }
}

// Uses the authenticated client throughout: RLS remains effective on every page.
export async function loadEventAttendance(db: SupabaseClient, eventId: string, summaryOnly = false): Promise<AttendanceSnapshot> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId)) throw new AttendanceReadError(400);
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (authError || !user) throw new AttendanceReadError(401);
  const { data: roles, error: roleError } = await db.from("event_user_roles").select("role,event_id")
    .eq("user_id", user.id).or(`and(role.eq.admin,event_id.is.null),and(event_id.eq.${eventId},role.in.(manager,manager_viewer))`);
  if (roleError) throw new AttendanceReadError(503);
  if (!roles?.some(role => (role.role === "admin" && role.event_id === null) ||
    (["manager", "manager_viewer"].includes(role.role) && role.event_id === eventId))) throw new AttendanceReadError(403);

  const result: AttendanceSnapshot = { eventId, updatedAt: "", entries: {}, schoolEntries: {},
    totals: { adults: 0, children: 0, students: 0, companions: 0, schoolBookings: 0, people: 0 } };
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from("check_ins").select(
      "id,registration_id,child_id,school_booking_id,checked_in_at,student_count,companion_count,registration:registrations!check_ins_registration_id_fkey(status,deleted_at,cancelled_at),school:school_bookings!check_ins_school_booking_id_fkey(status)",
    ).eq("event_id", eventId).is("moment_id", null).is("cancelled_at", null).order("id").range(offset, offset + 499);
    if (error || !data) throw new AttendanceReadError(503);
    for (const row of data) {
      // PostgREST many-to-one relations are objects. The generic client types
      // cannot infer cardinality without a generated schema.
      const registration = row.registration as unknown as { status: string; deleted_at: string | null; cancelled_at: string | null } | null;
      const school = row.school as unknown as { status: string } | null;
      if (row.school_booking_id) {
        if (!school || !["submitted", "confirmed"].includes(school.status)) continue;
        if (!Number.isSafeInteger(row.student_count) || !Number.isSafeInteger(row.companion_count) || row.student_count < 0 || row.companion_count < 0 || !Number.isFinite(Date.parse(row.checked_in_at))) throw new AttendanceReadError(503);
        result.totals.students += row.student_count;
        result.totals.companions += row.companion_count;
        result.totals.schoolBookings++;
        if (!summaryOnly) result.schoolEntries[row.school_booking_id] = { checkedInAt: row.checked_in_at, students: row.student_count, companions: row.companion_count };
      } else {
        if (!registration || registration.deleted_at || registration.cancelled_at || !["submitted", "confirmed"].includes(registration.status)) continue;
        if (!row.registration_id || !Number.isFinite(Date.parse(row.checked_in_at))) throw new AttendanceReadError(503);
        result.totals[row.child_id ? "children" : "adults"]++;
        if (!summaryOnly) result.entries[`${row.registration_id}:${row.child_id ?? "adult"}`] = row.checked_in_at;
      }
    }
    if (data.length < 500) break;
  }
  const t = result.totals;
  t.people = t.adults + t.children + t.students + t.companions;
  result.updatedAt = new Date().toISOString();
  return result;
}
