import type { SupabaseClient } from "@supabase/supabase-js";

export type PanelReleaseMode = "internal" | "catalog" | "open";

/** Database is the source of truth. A missing rollout migration stays closed;
 * connection/permission errors remain errors, never an apparent empty catalog. */
export async function getPanelReleaseMode(db: SupabaseClient): Promise<PanelReleaseMode> {
  const { data, error } = await db.rpc("get_panel_release_mode");
  if (error?.code === "PGRST202") return "internal";
  if (error) throw error;
  if (data !== "internal" && data !== "catalog" && data !== "open") {
    throw new Error("Stato di apertura forum non disponibile.");
  }
  return data;
}
