import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventUserRole } from "../auth/session.ts";
import { loadAllRows, loadRowsForIds } from "../supabase/all-rows.ts";
import { canAccessPanelManagement } from "./management-access.ts";

export type PanelRoster = {
  panelId: string;
  title: string;
  people: { id: string; firstName: string; lastName: string; kind: "Iscritto" | "Minore accompagnato"; accompanyingAdult: string; code: string }[];
  schools: { id: string; name: string; city: string; classDescription: string; students: number; companions: number }[];
  guests: { id: string; name: string; seats: number }[];
  individualSeats: number;
  schoolSeats: number;
  reservedGuestSeats: number;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isPanelRosterId(value: string): boolean { return uuid.test(value); }

/** Auth and current-event scope are checked before any participant data is read. */
export async function loadPanelRoster(db: SupabaseClient, panelId: string, roles: EventUserRole[]): Promise<PanelRoster | null> {
  if (!canAccessPanelManagement(roles)) throw new Error("Panel roster forbidden");
  if (!isPanelRosterId(panelId)) return null;
  const event = await db.from("events").select("id").eq("is_current", true).maybeSingle();
  if (event.error) throw new Error("Current event unavailable");
  if (!event.data) return null;
  const eventId = event.data.id as string;
  if (!canAccessPanelManagement(roles, eventId)) throw new Error("Panel roster forbidden");
  const panel = await db.from("event_moments").select("id,title").eq("id", panelId).eq("event_id", eventId).eq("moment_type", "panel").maybeSingle();
  if (panel.error) throw new Error("Panel unavailable");
  if (!panel.data) return null;

  const [choices, reservations, sections, audiences] = await Promise.all([
    loadAllRows<{ registration_id: string; seat_section_id: string | null }>((from, to) => db.from("moment_attendance_choices").select("registration_id,seat_section_id").eq("moment_id", panelId).eq("choice", "yes").order("id").range(from, to)),
    loadAllRows<{ booking_id: string; student_count: number; companion_count: number }>((from, to) => db.from("school_panel_reservations").select("booking_id,student_count,companion_count").eq("event_id", eventId).eq("panel_id", panelId).eq("status", "reserved").order("id").range(from, to)),
    loadAllRows<{ id: string; audience_type_id: string; capacity: number }>((from, to) => db.from("panel_seat_sections").select("id,audience_type_id,capacity").eq("event_id", eventId).eq("panel_id", panelId).order("id").range(from, to)),
    loadAllRows<{ id: string; name: string; booking_channel: string }>((from, to) => db.from("panel_audience_types").select("id,name,booking_channel").eq("event_id", eventId).order("id").range(from, to)),
  ]);
  const sectionIds = new Set(sections.data.map(row => row.id));
  const registrationIds = choices.data.filter(row => row.seat_section_id && sectionIds.has(row.seat_section_id)).map(row => row.registration_id);
  const [registrations, bookings] = await Promise.all([
    loadRowsForIds<{ id: string; participant_id: string }>(registrationIds, (ids, from, to) => db.from("registrations").select("id,participant_id").in("id", ids).eq("event_id", eventId).is("deleted_at", null).neq("status", "cancelled").order("id").range(from, to)),
    loadRowsForIds<{ id: string; school_name: string; school_city: string; class_description: string }>(reservations.data.map(row => row.booking_id), (ids, from, to) => db.from("school_bookings").select("id,school_name,school_city,class_description").in("id", ids).eq("event_id", eventId).neq("status", "cancelled").order("id").range(from, to)),
  ]);
  const [participants, children] = await Promise.all([
    loadRowsForIds<{ id: string; first_name: string | null; last_name: string | null; public_code: string | null }>(registrations.data.map(row => row.participant_id), (ids, from, to) => db.from("participants").select("id,first_name,last_name,public_code").in("id", ids).order("id").range(from, to)),
    loadRowsForIds<{ id: string; registration_id: string; first_name: string; last_name: string; position: number }>(registrations.data.map(row => row.id), (ids, from, to) => db.from("registration_children").select("id,registration_id,first_name,last_name,position").in("registration_id", ids).order("id").range(from, to)),
  ]);
  const identities = new Map(participants.data.map(row => [row.id, row]));
  const childrenByRegistration = new Map<string, typeof children.data>();
  for (const child of children.data) {
    const list = childrenByRegistration.get(child.registration_id) ?? [];
    list.push(child); childrenByRegistration.set(child.registration_id, list);
  }
  const people: PanelRoster["people"] = [];
  const sortedRegistrations = [...registrations.data].sort((a, b) => {
    const left = identities.get(a.participant_id), right = identities.get(b.participant_id);
    return `${left?.last_name ?? ""} ${left?.first_name ?? ""}`.localeCompare(`${right?.last_name ?? ""} ${right?.first_name ?? ""}`, "it") || a.id.localeCompare(b.id);
  });
  for (const registration of sortedRegistrations) {
    const person = identities.get(registration.participant_id);
    if (!person) throw new Error("Incomplete panel identities");
    const firstName = person.first_name?.trim() || "Nome non disponibile";
    const lastName = person.last_name?.trim() || "";
    people.push({ id: registration.id, firstName, lastName, kind: "Iscritto", accompanyingAdult: "", code: person.public_code ?? "" });
    for (const child of (childrenByRegistration.get(registration.id) ?? []).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))) {
      people.push({ id: child.id, firstName: child.first_name, lastName: child.last_name, kind: "Minore accompagnato", accompanyingAdult: `${firstName} ${lastName}`.trim(), code: "" });
    }
  }
  const bookingById = new Map(bookings.data.map(row => [row.id, row]));
  const schools: PanelRoster["schools"] = [];
  for (const reservation of reservations.data) {
    const booking = bookingById.get(reservation.booking_id);
    if (!booking) continue; // cancelled bookings are intentionally excluded
    if (![reservation.student_count, reservation.companion_count].every(value => Number.isInteger(value) && value >= 0)) throw new Error("Invalid school quantities");
    schools.push({ id: booking.id, name: booking.school_name, city: booking.school_city, classDescription: booking.class_description, students: reservation.student_count, companions: reservation.companion_count });
  }
  schools.sort((a, b) => a.name.localeCompare(b.name, "it") || a.classDescription.localeCompare(b.classDescription, "it") || a.id.localeCompare(b.id));
  const audienceById = new Map(audiences.data.map(row => [row.id, row]));
  const guests: PanelRoster["guests"] = [];
  for (const section of sections.data) {
    const audience = audienceById.get(section.audience_type_id);
    if (!audience || !Number.isInteger(section.capacity) || section.capacity < 0) throw new Error("Incomplete panel sections");
    if (audience.booking_channel === "internal_assignment") guests.push({ id: section.id, name: audience.name, seats: section.capacity });
  }
  return { panelId, title: panel.data.title, people, schools, guests, individualSeats: people.length, schoolSeats: schools.reduce((sum, row) => sum + row.students + row.companions, 0), reservedGuestSeats: guests.reduce((sum, row) => sum + row.seats, 0) };
}
