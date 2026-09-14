import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAllRows, loadRowsForIds } from "../supabase/all-rows.ts";
import { participantGeography, type ParticipantGeography } from "./geography.ts";
import { buildEventStatisticsSnapshot, type StatisticsChild } from "./event-statistics.ts";

type Registration = {
  id: string;
  event_id: string;
  events: { title: string | null } | null;
  participants: (ParticipantGeography & {
    first_name: string | null;
    last_name: string | null;
    birth_date: string | null;
  }) | null;
  registration_children: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    birth_date: string | null;
    position: number;
  }[];
};

// Caller must authenticate and authorize eventId before using the service client.
// Every source is paginated; no failed/partial read may become a missing-data bucket.
export async function loadEventStatisticsSnapshot(
  db: SupabaseClient,
  eventId: string,
  dates: { eventStartsOn: string | null; eventEndsOn: string | null },
) {
  const [{ data: registrations }, { data: groups }] = await Promise.all([
    loadAllRows((from, to) => db.from("registrations")
      .select("id,event_id,events(title),participants(first_name,last_name,birth_date,country_other,city_other,countries!participants_country_id_fkey(name_it),cities!participants_city_id_fkey(name)),registration_children(id,first_name,last_name,birth_date,position)")
      .eq("event_id", eventId).is("deleted_at", null).order("id").range(from, to)),
    loadAllRows((from, to) => db.from("groups")
      .select("id,event_id,name,parent_group_id,node_type")
      .eq("event_id", eventId).order("id").range(from, to)),
  ]);
  const rows = registrations as unknown as Registration[];
  const ids = rows.map((row) => row.id);
  const [{ data: assignments }, { data: attendanceChoices }] = await Promise.all([
    loadRowsForIds(ids, (batch, from, to) => db.from("participant_group_assignments")
      .select("registration_id,group_id")
      .in("registration_id", batch).eq("is_current", true).order("id").range(from, to)),
    loadRowsForIds(ids, (batch, from, to) => db.from("event_attendance_choices")
      .select("registration_id,day,day_part,choice")
      .in("registration_id", batch).order("id").range(from, to)),
  ]);
  const assignmentsById = new Map(assignments.map((row) => [row.registration_id, row]));
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  if (assignmentsById.size !== assignments.length) throw new Error("Multiple current group assignments");
  for (const group of groups) {
    const visited = new Set<string>();
    let current: typeof group | undefined = group;
    while (current) {
      if (visited.has(current.id)) throw new Error("Cyclic statistics group hierarchy");
      visited.add(current.id);
      if (!current.parent_group_id) break;
      current = groupsById.get(current.parent_group_id);
      if (!current) throw new Error("Incomplete statistics group hierarchy");
    }
  }
  return buildEventStatisticsSnapshot({
    ...dates,
    groups: groups.map((group) => ({
      id: group.id, eventId: group.event_id, name: group.name,
      parentGroupId: group.parent_group_id, nodeType: group.node_type,
    })),
    attendanceChoices,
    participants: rows.map((row) => {
      const participant = row.participants;
      if (!participant) throw new Error("Missing statistics participant");
      const assignment = assignmentsById.get(row.id);
      const group = assignment ? groupsById.get(assignment.group_id) : null;
      if (assignment && !group) throw new Error("Missing statistics assigned group");
      const children: StatisticsChild[] = row.registration_children.map((child) => ({
        id: child.id, firstName: child.first_name, lastName: child.last_name,
        birthDate: child.birth_date, position: child.position,
      }));
      return {
        registrationId: row.id, eventId: row.event_id, eventTitle: row.events?.title ?? "Evento",
        name: [participant.first_name, participant.last_name].filter(Boolean).join(" "),
        birthDate: participant.birth_date,
        ...participantGeography(participant),
        currentGroupId: group?.id ?? null, currentGroupName: group?.name ?? null,
        childrenCount: children.length, children,
      };
    }),
  });
}
