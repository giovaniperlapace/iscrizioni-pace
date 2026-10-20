import { schoolPanelSlot } from "./school-class-slots.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAllRows, loadRowsForIds } from "../supabase/all-rows.ts";

export type PanelWaitlistCount = { waitingPeople: number; offeredPeople: number };
export type PanelWaitlistEntry = {
  panel_id: string; registration_id: string; status: string;
  expires_at: string | null; reserved_seats: number | null;
  registrations: { status: string; deleted_at: string | null; registration_children: { id: string }[] };
};

export function countPanelWaitlist(
  rows: PanelWaitlistEntry[],
  selections: { panel_id: string; registration_id: string; child_ids: string[] }[],
  now = Date.now(),
): Map<string, PanelWaitlistCount> {
  const children = new Map(selections.map(row => [`${row.registration_id}:${row.panel_id}`, new Set(row.child_ids)]));
  const counts = new Map<string, PanelWaitlistCount>();
  for (const row of rows) {
    const registration = row.registrations;
    if (!registration || registration.deleted_at || !["submitted", "confirmed"].includes(registration.status)) continue;
    const count = counts.get(row.panel_id) ?? { waitingPeople: 0, offeredPeople: 0 };
    if (row.status === "waiting") {
      const selected = children.get(`${row.registration_id}:${row.panel_id}`);
      count.waitingPeople += 1 + registration.registration_children.filter(child => selected?.has(child.id)).length;
    } else if (row.status === "offered" && Date.parse(row.expires_at ?? "") > now) {
      count.offeredPeople += row.reserved_seats ?? 0;
    }
    counts.set(row.panel_id, count);
  }
  return counts;
}

/** Service client only, called after the dashboard's event/role authorization.
 * Return aggregate counts only; never serialize the queue's recipient data. */
export async function loadPanelWaitlistCounts(db: SupabaseClient, eventId: string) {
  return (await loadPanelWaitlistData(db, eventId)).counts;
}

/** Internal server data: callers must serialize only the resulting aggregates. */
export async function loadPanelWaitlistData(db: SupabaseClient, eventId: string) {
  const { data: rows } = await loadAllRows<PanelWaitlistEntry>((from, to) => db.from("panel_waitlist")
    .select("panel_id,registration_id,status,expires_at,reserved_seats,registrations!inner(status,deleted_at,registration_children(id))")
    .eq("event_id", eventId).in("status", ["waiting", "offered"]).order("id").range(from, to).returns<PanelWaitlistEntry[]>());
  const { data: selections } = await loadRowsForIds<{ panel_id: string; registration_id: string; child_ids: string[] }>(
    rows.map(row => row.panel_id), (ids, from, to) => db.from("panel_child_selections")
      .select("panel_id,registration_id,child_ids").in("panel_id", ids).order("panel_id").order("registration_id").range(from, to));
  return { rows, selections, counts: countPanelWaitlist(rows, selections) };
}

/** Unique nominal people with at least one queued slot lacking a confirmed booking.
 * A pending offer is not a confirmed booking; children are checked individually. */
export function countWaitlistedWithoutBooking(
  panels: { id: string; startsAt: string | null }[],
  choices: { registrationId: string; panelId: string; sectionId: string | null; choice: string; registrationStatus: string; selectedChildIds?: string[] }[],
  rows: PanelWaitlistEntry[],
  selections: { panel_id: string; registration_id: string; child_ids: string[] }[],
  now = Date.now(),
): number {
  const slots = new Map(panels.map(panel => [panel.id,
    panel.startsAt && Number.isFinite(Date.parse(panel.startsAt)) ? schoolPanelSlot(panel.startsAt) : null]));
  const booked = new Map<string, Set<string>>();
  for (const choice of choices) {
    const slot = slots.get(choice.panelId);
    if (!slot || choice.choice !== "yes" || !choice.sectionId || !["submitted", "confirmed"].includes(choice.registrationStatus)) continue;
    const people = [`adult:${choice.registrationId}`, ...(choice.selectedChildIds ?? []).map(id => `child:${choice.registrationId}:${id}`)];
    for (const person of people) {
      const current = booked.get(person) ?? new Set<string>();
      current.add(slot); booked.set(person, current);
    }
  }
  const selected = new Map(selections.map(row => [`${row.registration_id}:${row.panel_id}`, new Set(row.child_ids)]));
  const uncovered = new Set<string>();
  for (const row of rows) {
    const slot = slots.get(row.panel_id);
    const registration = row.registrations;
    if (!slot || !registration || registration.deleted_at || !["submitted", "confirmed"].includes(registration.status)) continue;
    if (row.status !== "waiting" && !(row.status === "offered" && Date.parse(row.expires_at ?? "") > now)) continue;
    const children = selected.get(`${row.registration_id}:${row.panel_id}`);
    const people = [`adult:${row.registration_id}`, ...registration.registration_children.filter(child => children?.has(child.id)).map(child => `child:${row.registration_id}:${child.id}`)];
    for (const person of people) if (!booked.get(person)?.has(slot)) uncovered.add(person);
  }
  return uncovered.size;
}
