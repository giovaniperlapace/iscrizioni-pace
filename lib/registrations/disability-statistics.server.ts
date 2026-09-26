import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAllRows, loadRowsForIds } from "../supabase/all-rows.ts";
import { declaredAccessibilityDifficulties } from "./accessibility-summary.ts";
import { buildEventStatisticsSnapshot, type EventStatisticsSnapshot } from "./event-statistics.ts";
import type { DisabilityStatisticsSnapshot } from "./disability-statistics.ts";

// Caller must authorize Admin, Manager or Manager Viewer for this event before invoking this loader.
export async function loadDisabilityStatistics(db: SupabaseClient, eventId: string): Promise<DisabilityStatisticsSnapshot> {
  const { data: active } = await loadAllRows((from, to) => db.from("registrations")
    .select("id").eq("event_id", eventId).is("deleted_at", null).order("id").range(from, to));
  const { data: declarations } = await loadRowsForIds(active.map(row => row.id), (ids, from, to) => db
    .from("accessibility_needs").select("registration_id,washington_group_answers")
    .in("registration_id", ids).order("id").range(from, to));
  const difficulties = new Map(declarations.map(row => [row.registration_id, declaredAccessibilityDifficulties(row.washington_group_answers)]));
  const ids = active.filter(row => difficulties.get(row.id)?.length).map(row => row.id);
  if (!ids.length) return { people: [] };

  const [{ data: registrations }, { data: groups }, { data: assignments }] = await Promise.all([
    loadRowsForIds(ids, (batch, from, to) => db.from("registrations")
      .select("id,event_id,participants(first_name,last_name)")
      .in("id", batch).eq("event_id", eventId).is("deleted_at", null).order("id").range(from, to)),
    loadAllRows((from, to) => db.from("groups")
      .select("id,event_id,name,parent_group_id,node_type,is_assignable")
      .eq("event_id", eventId).order("id").range(from, to)),
    loadRowsForIds(ids, (batch, from, to) => db.from("participant_group_assignments")
      .select("registration_id,group_id").in("registration_id", batch).eq("is_current", true).order("id").range(from, to)),
  ]);
  const groupsById = new Map(groups.map(group => [group.id, group]));
  const assignmentsById = new Map(assignments.map(row => [row.registration_id, row.group_id]));
  if (assignmentsById.size !== assignments.length) throw new Error("Multiple current disability statistics group assignments");
  for (const group of groups) {
    const visited = new Set<string>();
    let current: typeof group | undefined = group;
    while (current) {
      if (visited.has(current.id)) throw new Error("Cyclic disability statistics group hierarchy");
      visited.add(current.id);
      if (!current.parent_group_id) break;
      current = groupsById.get(current.parent_group_id);
      if (!current) throw new Error("Incomplete disability statistics group hierarchy");
    }
  }
  const snapshot = buildEventStatisticsSnapshot({
    attendanceChoices: [],
    groups: groups.map(group => ({ id: group.id, eventId: group.event_id, name: group.name,
      parentGroupId: group.parent_group_id, nodeType: group.node_type, isAssignable: group.is_assignable })),
    participants: registrations.map(row => {
      const participant = row.participants as unknown as { first_name: string | null; last_name: string | null } | null;
      if (!participant) throw new Error("Missing disability statistics participant");
      const groupId = assignmentsById.get(row.id);
      const group = groupId ? groupsById.get(groupId) : null;
      if (groupId && !group) throw new Error("Missing disability statistics assigned group");
      return {
        registrationId: row.id, eventId: row.event_id, eventTitle: "Evento",
        name: [participant.first_name, participant.last_name].filter(Boolean).join(" "),
        currentGroupId: group?.id ?? null, currentGroupName: group?.name ?? null,
        country: null, city: null, children: [], childrenCount: 0,
      };
    }),
  });
  return { people: snapshot.people.map(person => ({ ...person, declaredDifficulties: difficulties.get(person.registrationId)!.map(item => item.label.it).join("; "), difficultyKeys: difficulties.get(person.registrationId)!.map(item => item.key) })) };
}

// Use only after authorizing access to disability data for every supplied registration.
export async function withStatisticsDifficulties(db: SupabaseClient, statistics: EventStatisticsSnapshot): Promise<EventStatisticsSnapshot> {
  const ids = [...new Set(statistics.people.filter(person => person.kind === "participant").map(person => person.registrationId))];
  const { data } = await loadRowsForIds(ids, (batch, from, to) => db.from("accessibility_needs")
    .select("registration_id,washington_group_answers").in("registration_id", batch).order("id").range(from, to));
  const keys = new Map(data.map(row => [row.registration_id, declaredAccessibilityDifficulties(row.washington_group_answers).map(item => item.key)]));
  return { ...statistics, people: statistics.people.map(person => ({ ...person,
    difficultyKeys: person.kind === "participant" ? keys.get(person.registrationId) ?? [] : [],
  })) };
}
