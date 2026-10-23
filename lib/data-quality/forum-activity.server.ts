import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAllRows, loadRowsForIds } from "../supabase/all-rows.ts";
import { compareForums } from "../panels/forum-order.ts";

export type DuplicateForum = { id: string; title: string; offered?: boolean };
export type DuplicateForumActivity = { booked: DuplicateForum[]; queued: DuplicateForum[] };

/** Server-only read after qualityAccess: scope to the current event and visible registrations. */
export async function loadDuplicateForumActivity(
  db: SupabaseClient,
  eventId: string,
  registrationIds: string[],
): Promise<Map<string, DuplicateForumActivity>> {
  const activity = new Map<string, DuplicateForumActivity>(
    registrationIds.map(id => [id, { booked: [], queued: [] }]),
  );
  if (!activity.size) return activity;
  const { data: panels } = await loadAllRows<{ id: string; title: string }>((from, to) => db
    .from("event_moments").select("id,title").eq("event_id", eventId)
    .eq("moment_type", "panel").order("id").range(from, to));
  if (!panels.length) return activity;
  const panelById = new Map(panels.map(panel => [panel.id, panel]));
  const [bookings, queue] = await Promise.all([
    loadRowsForIds<{ registration_id: string; moment_id: string }>(registrationIds, (ids, from, to) => db
      .from("moment_attendance_choices").select("registration_id,moment_id")
      .in("registration_id", ids).in("moment_id", panels.map(panel => panel.id))
      .eq("choice", "yes").not("seat_section_id", "is", null).order("id").range(from, to)),
    loadRowsForIds<{ registration_id: string; panel_id: string; status: string; expires_at: string | null }>(registrationIds, (ids, from, to) => db
      .from("panel_waitlist").select("registration_id,panel_id,status,expires_at")
      .eq("event_id", eventId).in("registration_id", ids).in("status", ["waiting", "offered"])
      .order("id").range(from, to)),
  ]);
  const now = Date.now();
  for (const row of bookings.data) {
    const panel = panelById.get(row.moment_id);
    if (panel) activity.get(row.registration_id)?.booked.push(panel);
  }
  for (const row of queue.data) {
    const panel = panelById.get(row.panel_id);
    if (row.status === "offered" && !(Date.parse(row.expires_at ?? "") > now)) continue;
    if (panel) activity.get(row.registration_id)?.queued.push({ ...panel, offered: row.status === "offered" });
  }
  for (const entry of activity.values()) {
    entry.booked.sort(compareForums);
    entry.queued.sort(compareForums);
  }
  return activity;
}
