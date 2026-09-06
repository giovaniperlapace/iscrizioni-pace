import type { SupabaseClient } from "@supabase/supabase-js";
import { hashIdentityFingerprint } from "./fingerprint.server.ts";
import { loadAllRows, loadRowsForIds } from "../supabase/all-rows.ts";
import { identityFingerprint, pairKey, type Identity } from "./duplicates.ts";
import { type Catalog } from "./format.ts";
import {
  applyOperationsDashboardFilters,
  applyStatisticsDrilldownToOperations,
  parseOperationsDashboardFilters,
} from "../registrations/operations-dashboard.ts";
import {
  buildEventStatisticsSnapshot,
  parseStatisticsDrilldown,
  type StatisticsAttendanceChoice,
} from "../registrations/event-statistics.ts";

export type QualityPerson = Identity & {
  participantId: string;
  eventId: string;
  eventTitle: string;
  name: string;
  publicCode: string | null;
  authUserId: string | null;
  deletedAt: string | null;
  registrationStatus: string;
  submittedAt?: string | null;
  place: string;
  currentGroupId: string | null;
  currentGroupName: string | null;
  currentGroupStatus: string | null;
  currentServiceId: string | null;
  currentServiceStatus: string | null;
  tagIds: string[];
  children: {
    id: string;
    firstName: string;
    lastName: string;
    birthDate: string;
    position: number;
  }[];
  registrationId: string;
};
type Registration = {
  id: string;
  event_id: string;
  participant_id: string;
  status: string;
  submitted_at: string | null;
  deleted_at: string | null;
  participants: {
    first_name: string;
    last_name: string;
    birth_date: string | null;
    country_other: string | null;
    city_other: string | null;
    public_code: string;
    auth_user_id: string | null;
  } | null;
  registration_children: {
    id: string;
    first_name: string;
    last_name: string;
    birth_date: string;
    position: number;
  }[];
};
export async function loadQualityPeople(
  db: SupabaseClient,
  eventId: string,
): Promise<QualityPerson[]> {
  const registrations = (
    await loadAllRows((from, to) =>
      db
        .from("registrations")
        .select(
          "id,event_id,participant_id,status,submitted_at,deleted_at,participants(first_name,last_name,birth_date,country_other,city_other,public_code,auth_user_id),registration_children(id,first_name,last_name,birth_date,position)",
        )
        .eq("event_id", eventId)
        .order("id")
        .range(from, to),
    )
  ).data as unknown as Registration[];
  const ids = registrations.map((row) => row.id),
    pids = registrations.map((row) => row.participant_id);
  const [contacts, assignments, services, tags] = await Promise.all([
    loadRowsForIds(pids, (chunk, from, to) =>
      db
        .from("participant_contacts")
        .select("participant_id,email,phone")
        .in("participant_id", chunk)
        .eq("is_primary", true)
        .order("id")
        .range(from, to),
    ),
    loadRowsForIds(ids, (chunk, from, to) =>
      db
        .from("participant_group_assignments")
        .select(
          "registration_id,group_id,status,groups!participant_group_assignments_group_id_fkey(name)",
        )
        .in("registration_id", chunk)
        .eq("is_current", true)
        .order("id")
        .range(from, to),
    ),
    loadRowsForIds(ids, (chunk, from, to) =>
      db
        .from("participant_event_services")
        .select("registration_id,service_id,status")
        .in("registration_id", chunk)
        .order("id")
        .range(from, to),
    ),
    loadRowsForIds(pids, (chunk, from, to) =>
      db
        .from("participant_operational_tags")
        .select("participant_id,tag_id,operational_tags!inner(event_id)")
        .in("participant_id", chunk)
        .eq("operational_tags.event_id", eventId)
        .order("participant_id")
        .order("tag_id")
        .range(from, to),
    ),
  ]);
  const contactsByParticipant = new Map(
    contacts.data.map((row) => [row.participant_id, row]),
  );
  const groupsByRegistration = new Map(
    assignments.data.map((row) => [row.registration_id, row]),
  );
  const servicesByRegistration = new Map(
    services.data.map((row) => [row.registration_id, row]),
  );
  const tagsByParticipant = new Map<string, string[]>();
  for (const row of tags.data) {
    const list = tagsByParticipant.get(row.participant_id) ?? [];
    list.push(row.tag_id);
    tagsByParticipant.set(row.participant_id, list);
  }
  return registrations
    .filter((row) => row.participants)
    .map((row) => {
      const p = row.participants!;
      const contact = contactsByParticipant.get(row.participant_id);
      const group = groupsByRegistration.get(row.id);
      const groupRelation = group?.groups as unknown as { name: string } | null;
      const service = servicesByRegistration.get(row.id);
      return {
        id: row.id,
        registrationId: row.id,
        participantId: row.participant_id,
        eventId,
        eventTitle: "",
        firstName: p.first_name,
        lastName: p.last_name,
        name: `${p.first_name} ${p.last_name}`,
        birthDate: p.birth_date,
        country: p.country_other,
        city: p.city_other,
        place:
          [p.city_other, p.country_other].filter(Boolean).join(", ") ||
          "Provenienza non indicata",
        publicCode: p.public_code,
        authUserId: p.auth_user_id,
        email: contact?.email ?? null,
        phone: contact?.phone ?? null,
        registrationStatus: row.status,
        submittedAt: row.submitted_at ?? null,
        deletedAt: row.deleted_at,
        currentGroupId: group?.group_id ?? null,
        currentGroupName: groupRelation?.name ?? null,
        currentGroupStatus: group?.status ?? null,
        currentServiceId: service?.service_id ?? null,
        currentServiceStatus: service?.status ?? null,
        tagIds: tagsByParticipant.get(row.participant_id) ?? [],
        children: (row.registration_children ?? []).map((child) => ({
          id: child.id,
          firstName: child.first_name,
          lastName: child.last_name,
          birthDate: child.birth_date,
          position: child.position,
        })),
      };
    });
}
export async function loadCatalog(
  db: SupabaseClient,
  eventId: string,
  includeInactiveServices = false,
): Promise<Catalog> {
  const [groups, services, tags] = await Promise.all([
    loadAllRows((from, to) =>
      db
        .from("groups")
        .select("id,name")
        .eq("event_id", eventId)
        .eq("is_assignable", true)
        .eq("is_active", true)
        .order("id")
        .range(from, to),
    ),
    loadAllRows((from, to) => {
      const query = db
        .from("event_services")
        .select("id,label")
        .eq("event_id", eventId);
      return (includeInactiveServices ? query : query.eq("is_active", true))
        .order("id")
        .range(from, to);
    }),
    loadAllRows((from, to) =>
      db
        .from("operational_tags")
        .select("id,label")
        .eq("event_id", eventId)
        .order("id")
        .range(from, to),
    ),
  ]);
  return {
    groups: groups.data.map((row) => ({ id: row.id, label: row.name })),
    services: services.data,
    tags: tags.data,
  };
}
export async function loadDismissals(
  db: SupabaseClient,
  eventId: string,
  people: Identity[],
) {
  const rows = (
    await loadAllRows((from, to) =>
      db
        .from("duplicate_reviews")
        .select("left_id,right_id,left_fingerprint,right_fingerprint")
        .eq("event_id", eventId)
        .eq("decision", "not_duplicate")
        .order("id")
        .range(from, to),
    )
  ).data;
  const fingerprints = new Map(
    people.map((person) => [
      person.id,
      hashIdentityFingerprint(identityFingerprint(person)),
    ]),
  );
  return new Set(
    rows
      .filter(
        (row) =>
          fingerprints.get(row.left_id) === row.left_fingerprint &&
          fingerprints.get(row.right_id) === row.right_fingerprint,
      )
      .map((row) => pairKey(row.left_id, row.right_id)),
  );
}
export async function filteredExportPeople(
  db: SupabaseClient,
  event: {
    id: string;
    title: string;
    starts_on: string | null;
    ends_on: string | null;
  },
  params: URLSearchParams,
) {
  const all = (await loadQualityPeople(db, event.id)).map((person) => ({
    ...person,
    eventTitle: event.title,
  }));
  const deleted = params.get("view") === "deleted";
  let people = applyOperationsDashboardFilters(
    all.filter((person) => Boolean(person.deletedAt) === deleted),
    parseOperationsDashboardFilters(Object.fromEntries(params)),
  );
  if (params.get("view") === "without-group")
    people = people.filter((person) => !person.currentGroupId);
  const attendance = (
    await loadRowsForIds(
      all.map((person) => person.id),
      (ids, from, to) =>
        db
          .from("event_attendance_choices")
          .select("registration_id,day,day_part,choice")
          .in("registration_id", ids)
          .order("id")
          .range(from, to),
    )
  ).data as StatisticsAttendanceChoice[];
  const drilldown = parseStatisticsDrilldown(params.get("stat") ?? undefined);
  if (params.has("stat") && !drilldown)
    throw new Error("Filtro statistiche non valido.");
  if (drilldown) {
    const groups = (
      await loadAllRows((from, to) =>
        db
          .from("groups")
          .select("id,event_id,name,parent_group_id,node_type")
          .eq("event_id", event.id)
          .order("id")
          .range(from, to),
      )
    ).data;
    const statistics = buildEventStatisticsSnapshot({
      participants: all.filter((p) => !p.deletedAt),
      groups: groups.map((g) => ({
        id: g.id,
        eventId: g.event_id,
        name: g.name,
        parentGroupId: g.parent_group_id,
        nodeType: g.node_type,
      })),
      attendanceChoices: attendance,
      eventStartsOn: event.starts_on,
      eventEndsOn: event.ends_on,
    });
    people = applyStatisticsDrilldownToOperations(
      people,
      statistics,
      drilldown,
    ).participants;
  }
  return {
    people,
    attendance: attendance.filter((choice) =>
      people.some((person) => person.id === choice.registration_id),
    ),
  };
}
