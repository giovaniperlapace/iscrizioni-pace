import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAllRows, loadRowsForIds } from "../supabase/all-rows.ts";
import type { PresenceSource } from "./types.ts";

// Authorize the current event before calling with a service client. Read only;
// no names, contacts, birth dates, disability data or internal sex are loaded.
export async function loadPresenceSource(db: SupabaseClient, event: PresenceSource["event"], withServices: boolean): Promise<PresenceSource> {
  const extractedAt = new Date().toISOString();
  const [registrations, groups, services, tags] = await Promise.all([
    loadAllRows((from, to) => db.from("registrations").select("id,participant_id")
      .eq("event_id", event.id).is("deleted_at", null).order("id").range(from, to)),
    loadAllRows((from, to) => db.from("groups").select("id,name,parent_group_id,is_assignable")
      .eq("event_id", event.id).order("id").range(from, to)),
    withServices ? loadAllRows((from, to) => db.from("event_services").select("id,label")
      .eq("event_id", event.id).order("id").range(from, to)) : { data: [] },
    // Also used to show which configured operator tags exist in the raccordo.
    loadAllRows((from, to) => db.from("operational_tags").select("id,label")
      .eq("event_id", event.id).order("id").range(from, to)),
  ]);
  const ids = registrations.data.map(row => row.id);
  const pids = registrations.data.map(row => row.participant_id);
  const [children, assignments, attendance, serviceAssignments, tagAssignments] = await Promise.all([
    loadRowsForIds(ids, (batch, from, to) => db.from("registration_children").select("id,registration_id")
      .in("registration_id", batch).order("id").range(from, to)),
    loadRowsForIds(ids, (batch, from, to) => db.from("participant_group_assignments").select("registration_id,group_id")
      .in("registration_id", batch).eq("is_current", true).order("id").range(from, to)),
    loadRowsForIds(ids, (batch, from, to) => db.from("event_attendance_choices").select("registration_id,day,day_part,choice")
      .in("registration_id", batch).order("id").range(from, to)),
    withServices ? loadRowsForIds(ids, (batch, from, to) => db.from("participant_event_services").select("registration_id,service_id,status")
      .in("registration_id", batch).eq("event_id", event.id).eq("status", "assigned").order("id").range(from, to)) : { data: [] },
    withServices ? loadRowsForIds(pids, (batch, from, to) => db.from("participant_operational_tags").select("participant_id,tag_id,operational_tags!inner(event_id)")
      .in("participant_id", batch).eq("operational_tags.event_id", event.id).order("participant_id").order("tag_id").range(from, to)) : { data: [] },
  ]);
  return { event, extractedAt, registrations: registrations.data, groups: groups.data,
    children: children.data, assignments: assignments.data, attendance: attendance.data,
    services: services.data, serviceAssignments: serviceAssignments.data, tags: tags.data, tagAssignments: tagAssignments.data };
}
