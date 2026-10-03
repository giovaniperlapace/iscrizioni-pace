import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAllRows, loadRowsForIds } from "../supabase/all-rows.ts";

/** Keep unregistered operational identities; exclude people with only deleted registrations. */
export async function reusableIdentityParticipantIds(db: SupabaseClient, ids: string[]): Promise<string[]> {
  const { data } = await loadRowsForIds(ids, (batch, from, to) => db
    .from("registrations").select("id,participant_id,deleted_at")
    .in("participant_id", batch).order("id").range(from, to));
  const registered = new Set(data.map(row => row.participant_id));
  const active = new Set(data.filter(row => !row.deleted_at).map(row => row.participant_id));
  return [...new Set(ids)].filter(id => !registered.has(id) || active.has(id));
}

export async function emailParticipantIds(db: SupabaseClient, email: string): Promise<string[]> {
  const { data } = await loadAllRows((from, to) => db.from("participant_contacts")
    .select("participant_id").eq("email", email.trim().toLowerCase()).order("id").range(from, to));
  return [...new Set(data.map(row => row.participant_id as string))];
}
