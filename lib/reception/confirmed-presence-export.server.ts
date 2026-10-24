import type { SupabaseClient } from "@supabase/supabase-js";
import { loadRowsForIds } from "../supabase/all-rows.ts";

// Call only after event/group authorization, with IDs from the export result.
// A child's check-in or a Forum/ceremony entry never confirms the adult's badge.
export async function loadConfirmedExportPresences(db: SupabaseClient, eventId: string, registrationIds: string[]) {
  const { data } = await loadRowsForIds(registrationIds, async (ids, from, to) => {
    const result = await db.from("check_ins")
      .select("id,registration_id,registration:registrations!check_ins_registration_id_fkey!inner(status,deleted_at,cancelled_at)")
      .eq("event_id", eventId).in("registration_id", ids)
      .is("moment_id", null).is("child_id", null).is("school_booking_id", null).is("cancelled_at", null)
      .in("registration.status", ["submitted", "confirmed"])
      .is("registration.deleted_at", null).is("registration.cancelled_at", null)
      .order("id").range(from, to);
    if (!result.data || result.error) throw new Error("Presenze confermate non disponibili");
    return result;
  });
  return new Set<string>(data.map(row => row.registration_id));
}
