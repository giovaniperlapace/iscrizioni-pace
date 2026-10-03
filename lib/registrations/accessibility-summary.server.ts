import type { SupportedLocale } from "../i18n/config.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadRowsForIds } from "../supabase/all-rows.ts";
import { accessibilitySummary } from "./accessibility-summary.ts";

// Callers must supply only registrations the actor may manage, including scoped group leaders.
export async function loadAccessibilitySummaries(db: SupabaseClient, registrationIds: string[], locale: SupportedLocale = "it") {
  const { data } = await loadRowsForIds(registrationIds, (ids, from, to) => db
    .from("accessibility_needs").select("registration_id,washington_group_answers")
    .in("registration_id", ids).order("id").range(from, to));
  return new Map(data.map(row => [row.registration_id as string, accessibilitySummary(row.washington_group_answers, locale)]));
}
