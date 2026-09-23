import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAllRows, loadRowsForIds } from "../supabase/all-rows.ts";
import type { GroupGeographyCatalog } from "./geography.ts";

export async function loadGroupGeographyCatalog(db: SupabaseClient): Promise<GroupGeographyCatalog> {
  const [countries, cities] = await Promise.all([
    loadAllRows((from, to) => db.from("countries").select("id,iso2,name_it,name_en,is_active").order("id").range(from, to)),
    loadAllRows((from, to) => db.from("cities").select("id,country_id,name,is_active").order("id").range(from, to)),
  ]);
  if (countries.error || cities.error) throw new Error("Unable to load group geography catalog");
  return { countries: countries.data ?? [], cities: cities.data ?? [] };
}

/** Paginate links too: a country's groups may have well over 1,000 city links. */
export async function loadGroupCityLinks(db: SupabaseClient, groupIds: string[]): Promise<Map<string, string[]>> {
  const { data } = await loadRowsForIds<{ group_id: string; city_id: string }>(groupIds, (ids, from, to) => db
    .from("group_suggestion_cities").select("group_id,city_id").in("group_id", ids)
    .order("group_id").order("city_id").range(from, to));
  const byGroup = new Map<string, string[]>();
  for (const row of data) byGroup.set(row.group_id, [...(byGroup.get(row.group_id) ?? []), row.city_id]);
  return byGroup;
}
