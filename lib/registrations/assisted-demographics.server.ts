import type { SupabaseClient } from "@supabase/supabase-js";
import { loadRowsForIds } from "../supabase/all-rows.ts";
import type { InternalSex } from "./assisted-demographics.ts";

// Only registration IDs from the caller's already authorized event/scope.
export async function loadNationalities(db: SupabaseClient, registrationIds: string[]) {
  const { data } = await loadRowsForIds(registrationIds, (ids, from, to) => db
    .from("registration_questionnaire_answers")
    .select("id,registration_id,created_at,nationality:answers->>nationality")
    .in("registration_id", ids).order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to));
  const result = new Map<string, string | null>();
  for (const row of data) if (!result.has(row.registration_id)) result.set(row.registration_id, row.nationality ?? null);
  return result;
}

// Deliberately separate from ordinary registration/dashboard loaders. Called
// only for a visible internal column (including its requested table export).
export async function loadInternalSexes(db: SupabaseClient, registrationIds: string[], actorUserId: string) {
  const ids = [...new Set(registrationIds)].sort();
  const result: Record<string, InternalSex> = {};
  for (let offset = 0; offset < ids.length; offset += 200) {
    const { data, error } = await db.rpc("get_operational_registration_sexes", {
      p_registration_ids: ids.slice(offset, offset + 200), p_actor_user_id: actorUserId,
    });
    if (error) throw new Error("Internal column unavailable");
    for (const row of data ?? []) {
      if (row.sex !== "male" && row.sex !== "female") throw new Error("Invalid internal value");
      result[row.registration_id] = row.sex;
    }
  }
  return result;
}
