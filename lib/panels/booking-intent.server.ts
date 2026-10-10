import type { SupabaseClient } from "@supabase/supabase-js";
import { parseForumIntent } from "./booking-intent";
import { getPanelReleaseMode } from "./release";
import { getPublicPanelProgram } from "./public-program";

// A selection never opens the catalogue or books a seat. Only published forums
// in the current, explicitly open event can become a login destination.
export async function resolvePublicForumIntent(db: SupabaseClient, value: unknown): Promise<string | null> {
  const forum = parseForumIntent(value);
  if (!forum || await getPanelReleaseMode(db) !== "open") return null;
  const panels = await getPublicPanelProgram(db);
  return panels.some(panel => panel.id === forum) ? forum : null;
}
