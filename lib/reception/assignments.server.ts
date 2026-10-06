import type { SupabaseClient } from "@supabase/supabase-js";

export async function requirePanelManager(db: SupabaseClient) {
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (authError || !user) return null;
  const { data: event, error: eventError } = await db.from("events").select("id,title").eq("is_current", true).maybeSingle();
  if (eventError || !event) return null;
  const { data: roles, error: rolesError } = await db.from("event_user_roles").select("role,event_id").eq("user_id", user.id);
  if (rolesError || !roles?.some(row => (row.role === "admin" && row.event_id === null) || (row.role === "manager" && row.event_id === event.id))) return null;
  return { userId: user.id, event, dashboard: roles.some(row => row.role === "admin" && row.event_id === null) ? "admin" as const : "manager" as const };
}

export type PanelAssignment = { id: string; panelId: string; userId: string; duty: "panel_entry" | "room_assistance"; name: string; email: string };
export async function loadPanelAssignments(db: SupabaseClient, eventId: string): Promise<PanelAssignment[]> {
  const result: PanelAssignment[] = [];
  for (let from = 0; ; from += 200) {
    const { data, error } = await db.from("panel_reception_assignments")
      .select("id,panel_id,user_id,duty,profile:profiles!panel_reception_assignments_user_id_fkey(full_name,email)")
      .eq("event_id", eventId).order("id").range(from, from + 199);
    if (error || !data) throw new Error("Impossibile caricare gli incarichi panel.");
    for (const row of data) {
      const profile = row.profile as unknown as { full_name: string | null; email: string | null } | null;
      if (!profile || !["panel_entry", "room_assistance"].includes(row.duty)) throw new Error("Incarichi incompleti.");
      result.push({ id: row.id, panelId: row.panel_id, userId: row.user_id, duty: row.duty, name: profile.full_name ?? "Nome non disponibile", email: profile.email ?? "" });
    }
    if (data.length < 200) return result;
  }
}
