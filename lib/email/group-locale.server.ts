import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAllRows } from "../supabase/all-rows.ts";
import { emailLocaleForCountry, groupCountryId, type EmailLocaleGroup } from "./group-locale.ts";

export async function loadGroupEmailLocale(db: SupabaseClient, eventId: string, groupId: string | null) {
  if (!groupId) return { locale: "en" as const, countryIso2: null, groupId: null };
  const { data: groups } = await loadAllRows<EmailLocaleGroup>((from, to) => db.from("groups")
    .select("id,event_id,parent_group_id,country_id,node_type,is_active")
    .eq("event_id", eventId).order("id").range(from, to));
  const countryId = groupCountryId(groups, eventId, groupId);
  if (!countryId) return { locale: "en" as const, countryIso2: null, groupId };
  const { data: country, error } = await db.from("countries").select("iso2").eq("id", countryId).single();
  if (error || !country) throw new Error("Cannot resolve email group country");
  const countryIso2 = country.iso2?.trim().toUpperCase() ?? null;
  return { locale: emailLocaleForCountry(countryIso2), countryIso2, groupId };
}

/** Registration and assignment are read from the database, never from a form locale. */
export async function loadRegistrationEmailLocale(db: SupabaseClient, eventId: string, registrationId: string) {
  const { data: registration, error } = await db.from("registrations").select("id,status")
    .eq("id", registrationId).eq("event_id", eventId).is("deleted_at", null).single();
  if (error || !registration || registration.status === "cancelled") throw new Error("Invalid email registration");
  const { data: assignments, error: assignmentError } = await db.from("participant_group_assignments")
    .select("group_id").eq("registration_id", registrationId).eq("is_current", true).limit(2);
  if (assignmentError || !assignments || assignments.length > 1) throw new Error("Cannot resolve email assignment");
  return loadGroupEmailLocale(db, eventId, assignments[0]?.group_id ?? null);
}
