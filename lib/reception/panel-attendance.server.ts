import type { SupabaseClient } from "@supabase/supabase-js";

// Called only from the already-authorized operational statistics loader.
// Missing migration/read failure stays unavailable, never an invented zero.
export async function loadPanelAttendanceTotals(db: SupabaseClient, eventId: string): Promise<Map<string, number> | null> {
  const totals = new Map<string, number>();
  for (let from = 0; ; from += 500) {
    const { data, error } = await db.from("check_ins")
      .select("id,moment_id,seat_section_id,registration_id,school_booking_id,student_count,companion_count,registration:registrations!check_ins_registration_id_fkey(status,deleted_at,cancelled_at),school:school_bookings!check_ins_school_booking_id_fkey(status)")
      .eq("event_id", eventId).not("moment_id", "is", null).is("cancelled_at", null).order("id").range(from, from + 499);
    if (error || !data) return null;
    for (const row of data) {
      let people: number;
      if (row.school_booking_id) {
        const booking = row.school as unknown as { status: string } | null;
        if (!booking || !["submitted", "confirmed"].includes(booking.status)) continue;
        if (![row.student_count, row.companion_count].every(value => Number.isSafeInteger(value) && value >= 0)) return null;
        people = row.student_count + row.companion_count;
      } else {
        const registration = row.registration as unknown as { status: string; deleted_at: string | null; cancelled_at: string | null } | null;
        if (!registration || registration.deleted_at || registration.cancelled_at || !["submitted", "confirmed"].includes(registration.status)) continue;
        people = 1;
      }
      if (typeof row.moment_id !== "string") return null;
      totals.set(row.moment_id, (totals.get(row.moment_id) ?? 0) + people);
    }
    if (data.length < 500) return totals;
  }
}
