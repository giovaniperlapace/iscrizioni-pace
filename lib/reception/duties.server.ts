import type { SupabaseClient } from "@supabase/supabase-js";

export type ReceptionDuty =
  | { key: "event_entry"; duty: "event_entry"; title: string; room: null }
  | { key: string; duty: "panel_entry" | "room_assistance"; panelId: string; title: string; room: string | null };

// Navigation capability only: this never adds an event role or authorizes a command.
export async function hasPanelReceptionDuty(db: SupabaseClient): Promise<boolean> {
  const { data, error } = await db.rpc("has_panel_reception_duty");
  return !error && data === true;
}

export async function loadPanelReceptionDuties(db: SupabaseClient): Promise<ReceptionDuty[]> {
  const duties: ReceptionDuty[] = [];
  for (let offset = 0; ; offset += 200) {
    const { data, error } = await db.rpc("my_panel_reception_duties").order("assignment_id").range(offset, offset + 199);
    // The event scanner can keep operating while the new migration awaits activation.
    if (error?.code === "PGRST202" || error?.code === "42883") return [];
    if (error || !Array.isArray(data)) throw new Error("Impossibile caricare gli incarichi panel.");
    for (const row of data) {
      if (!["panel_entry", "room_assistance"].includes(row.duty) || typeof row.panel_id !== "string" || typeof row.title !== "string") {
        throw new Error("Incarichi panel non disponibili.");
      }
      duties.push({ key: row.assignment_id, duty: row.duty, panelId: row.panel_id, title: row.title, room: row.room });
    }
    if (data.length < 200) return duties;
  }
}
