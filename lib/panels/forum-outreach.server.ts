import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAllRows } from "../supabase/all-rows.ts";
import { getAllIndividualChoices } from "./panel-statistics.ts";
import { findWaitlistedWithoutBooking, loadPanelWaitlistData } from "./waitlist-statistics.ts";
import { findPeopleWithoutForum, findPanelCampaignTargets, type ForumOutreach } from "./forum-outreach.ts";

/** Called only after event-scoped campaign authorization. No writes or delivery. */
export async function loadForumOutreachTargets(db: SupabaseClient, eventId: string, mode: ForumOutreach, panelId?: string | null) {
  const { data: panels } = await loadAllRows<{ id: string; starts_at: string | null }>((from, to) => db.from("event_moments")
    .select("id,starts_at").eq("event_id", eventId).eq("moment_type", "panel").order("id").range(from, to));
  if (mode.startsWith("panel_") && (!panelId || !panels.some(panel => panel.id === panelId))) throw new Error("Forum non disponibile nell’evento corrente.");
  const choices = await getAllIndividualChoices(db, panels.filter(panel => !mode.startsWith("panel_") || panel.id === panelId).map(panel => panel.id));
  if (mode.startsWith("panel_")) {
    const queue = mode === "panel_confirmed" ? [] : (await loadPanelWaitlistData(db, eventId)).rows;
    return { registrationIds: findPanelCampaignTargets(panelId!, mode, choices, queue) };
  }
  if (mode === "waiting_without_booking") {
    const queue = await loadPanelWaitlistData(db, eventId);
    return findWaitlistedWithoutBooking(panels.map(panel => ({id: panel.id, startsAt: panel.starts_at})), choices, queue.rows, queue.selections);
  }
  const { data: registrations } = await loadAllRows<{id: string; registration_children: {id: string}[] | null}>((from, to) => db.from("registrations")
    .select("id,registration_children(id)").eq("event_id", eventId).is("deleted_at", null).in("status", ["submitted", "confirmed"]).order("id").range(from, to));
  return findPeopleWithoutForum(registrations, choices);
}
