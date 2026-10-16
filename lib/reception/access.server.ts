import type { SupabaseClient } from "@supabase/supabase-js";
import { canOperateReception } from "./access.ts";

export async function isReceptionOperator(db: SupabaseClient): Promise<boolean> {
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) return false;
  const { data: event, error: eventError } = await db.from("events").select("id").eq("is_current", true).maybeSingle();
  if (eventError || !event) return false;
  const { data: roles, error: roleError } = await db.from("event_user_roles").select("role,event_id").eq("user_id", user.id);
  return !roleError && canOperateReception(roles ?? [], event.id);
}
