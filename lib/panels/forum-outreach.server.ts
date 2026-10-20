import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAllRows } from "../supabase/all-rows.ts";
import { getAllIndividualChoices } from "./panel-statistics.ts";
import { findWaitlistedWithoutBooking, loadPanelWaitlistData } from "./waitlist-statistics.ts";
import { findPeopleWithoutForum, type ForumOutreach } from "./forum-outreach.ts";

/** Called only after event-scoped campaign authorization. No writes or delivery. */
export async function loadForumOutreachTargets(db: SupabaseClient, eventId: string, mode: ForumOutreach) {
  const { data: panels } = await loadAllRows<{ id: string; starts_at: string | null }>((from, to) => db.from("event_moments")
    .select("id,starts_at").eq("event_id", eventId).eq("moment_type", "panel").order("id").range(from, to));
  const choices = await getAllIndividualChoices(db, panels.map(panel => panel.id));
  if (mode === "waiting_without_booking") {
    const queue = await loadPanelWaitlistData(db, eventId);
    return findWaitlistedWithoutBooking(panels.map(panel => ({id: panel.id, startsAt: panel.starts_at})), choices, queue.rows, queue.selections);
  }
  const { data: registrations } = await loadAllRows<{id: string; registration_children: {id: string}[] | null}>((from, to) => db.from("registrations")
    .select("id,registration_children(id)").eq("event_id", eventId).is("deleted_at", null).in("status", ["submitted", "confirmed"]).order("id").range(from, to));
  return findPeopleWithoutForum(registrations, choices);
}
