import type { SupabaseClient } from "@supabase/supabase-js";
import { canAccessPausedSite } from "../site-pause.ts";

/** Fail closed; only canonical roles in the current event, or global admin. */
export async function hasPausedSiteAccess(db: SupabaseClient, userId: string): Promise<boolean> {
  const { data: roles, error } = await db.from("event_user_roles")
    .select("role,event_id").eq("user_id", userId);
  if (error || !roles) return false;
  if (canAccessPausedSite(roles, null)) return true;
  const { data: event, error: eventError } = await db.from("events")
    .select("id").eq("is_current", true).maybeSingle();
  return !eventError && canAccessPausedSite(roles, event?.id ?? null);
}

export async function hasPausedSiteEmailAccess(db: SupabaseClient, email: string): Promise<boolean> {
  const { data: profiles, error } = await db.from("profiles").select("id")
    .eq("email", email).limit(2);
  if (error || profiles?.length !== 1) return false;
  return hasPausedSiteAccess(db, profiles[0].id);
}
