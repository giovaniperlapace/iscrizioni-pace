import type { SupabaseClient } from "@supabase/supabase-js";
// Rollout boundary: preserve the underlying role model for later activation.
export async function isAdminReceptionPilot(db: SupabaseClient): Promise<boolean> {
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) return false;
  const { data: roles, error: roleError } = await db.from("event_user_roles").select("role,event_id").eq("user_id", user.id);
  return !roleError && !!roles?.some(r => r.role === "admin" && r.event_id === null);
}

export async function createAdminPilotClient() {
  const { createSupabaseServerClient } = await import("../supabase/server.ts");
  const session = await createSupabaseServerClient();
  if (!await isAdminReceptionPilot(session)) throw new Error("Funzione in collaudo riservato all’Admin.");
  return session;
}
