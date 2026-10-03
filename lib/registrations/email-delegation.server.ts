import type { SupabaseClient } from "@supabase/supabase-js";
import { loadRowsForIds } from "../supabase/all-rows.ts";
import { hasRecordedEmailDelegation } from "./email-delegation.ts";

/** Call only with registration IDs from an already authorized, event-scoped read. */
export async function loadEmailDelegations(db: SupabaseClient, registrationIds: string[]) {
  const { data } = await loadRowsForIds(registrationIds, (ids, from, to) => db
    .from("registration_questionnaire_answers")
    .select("id,registration_id,source:answers->>source,use_leader_email:answers->contact->useLeaderEmail,has_email:answers->contact->hasEmail")
    .in("registration_id", ids).order("id").range(from, to));
  return new Set(data.filter(hasRecordedEmailDelegation).map(row => row.registration_id as string));
}
