import type { SupabaseClient } from "@supabase/supabase-js";
import { loadRowsForIds } from "../supabase/all-rows.ts";

// IDs must come from the caller's authorized admin/manager event result.
export async function loadAssociations(db: SupabaseClient, registrationIds: string[]) {
  const { data } = await loadRowsForIds(registrationIds, (ids, from, to) => db
    .from("registration_questionnaire_answers")
    .select("id,registration_id,created_at,association:answers->externalGroupAssociation")
    .in("registration_id", ids).order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to));
  const result = new Map<string, string | null>();
  for (const row of data) if (!result.has(row.registration_id)) {
    result.set(row.registration_id, typeof row.association === "string" ? row.association.trim() || null : null);
  }
  return result;
}
