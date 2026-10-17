import type { SupabaseClient } from "@supabase/supabase-js";
import { loadRowsForIds } from "../supabase/all-rows.ts";
import { hasRecordedEmailDelegation } from "./email-delegation.ts";

/** Authorized IDs only. Preserve latest-answer semantics, including cleared values,
 * while delegation deliberately considers every recorded manual choice. */
export async function loadQuestionnaireSummaries(db: SupabaseClient, registrationIds: string[]) {
  const { data } = await loadRowsForIds(registrationIds, (ids, from, to) => db
    .from("registration_questionnaire_answers")
    .select("id,registration_id,created_at,nationality:answers->>nationality,association:answers->externalGroupAssociation,source:answers->>source,use_leader_email:answers->contact->useLeaderEmail,has_email:answers->contact->hasEmail")
    .in("registration_id", ids).order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to));
  const nationalities = new Map<string, string | null>();
  const associations = new Map<string, string | null>();
  const emailDelegations = new Set<string>();
  for (const row of data) {
    if (!nationalities.has(row.registration_id)) {
      nationalities.set(row.registration_id, row.nationality ?? null);
      associations.set(row.registration_id, typeof row.association === "string" ? row.association.trim() || null : null);
    }
    if (hasRecordedEmailDelegation(row)) emailDelegations.add(row.registration_id);
  }
  return { nationalities, associations, emailDelegations };
}
