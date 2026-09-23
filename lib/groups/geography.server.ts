import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAllRows } from "../supabase/all-rows.ts";
import type { GroupGeographyCatalog } from "./geography.ts";

export async function loadGroupGeographyCatalog(db: SupabaseClient): Promise<GroupGeographyCatalog> {
  const [countries, cities] = await Promise.all([
    loadAllRows((from, to) => db.from("countries").select("id,iso2,name_it,name_en,is_active").order("id").range(from, to)),
    loadAllRows((from, to) => db.from("cities").select("id,country_id,name,is_active").order("id").range(from, to)),
  ]);
  if (countries.error || cities.error) throw new Error("Unable to load group geography catalog");
  return { countries: countries.data ?? [], cities: cities.data ?? [] };
}
