import type { SupabaseClient } from "@supabase/supabase-js";
import type { SupportedLocale } from "../i18n/config.ts";
import { loadAllRows, loadAllRowsConcurrently, loadRowsForIds } from "../supabase/all-rows.ts";
import { participantGeography, type ParticipantGeography } from "./geography.ts";
import { applyOperationsDashboardFilters, summarizeOperationsDashboardParticipants, type OperationsDashboardFilters } from "./operations-dashboard.ts";
import { paginateParticipants, parseTablePreferences } from "./operations-table.ts";
import { sortOperationsParticipants } from "./operations-sort.ts";
import type { OperationsParticipantRow, OperationsParticipantsSnapshot, OperationsRegistrationChild } from "./operations-types.ts";
import { loadQuestionnaireSummaries } from "./questionnaire-summary.server.ts";
import { loadAttendanceSummaries } from "./attendance-summary.server.ts";
import { loadAccessibilitySummaries } from "./accessibility-summary.server.ts";
import { loadInternalSexes } from "./assisted-demographics.server.ts";
import { internalSexText } from "./assisted-demographics.ts";
import { getOperationalUserIdentities } from "../operational-users/identity.ts";

type Service = {
  id: string; event_id: string; registration_id: string; participant_id: string; service_id: string;
  status: string; source: string; participant_note?: string | null; operator_note?: string | null; updated_at?: string | null;
  event_services: { label: string | null } | null;
};
type IndexRow = {
  id: string; event_id: string; participant_id: string; status: string | null; submitted_at: string | null;
  deleted_at: string | null; deleted_by: string | null; deletion_reason: string | null;
  registration_children: { id: string }[];
  participant_group_assignments: { id: string; group_id: string; status: string | null; groups: { name: string | null } | null }[];
  participants: (ParticipantGeography & {
    id: string; auth_user_id: string | null; first_name: string | null; last_name: string | null;
    birth_date: string | null; public_code: string | null;
    participant_contacts: { id: string; email: string | null; phone: string | null }[];
    participant_event_services: Service[];
    participant_operational_tags: { tag_id: string; assigned_at: string | null; operational_tags: { id: string; event_id: string; label: string; color: string } | null }[];
  }) | null;
};

export type OperationsPageRequest = {
  event: { id: string; title: string; starts_on?: string | null };
  actorId: string;
  canManage: boolean;
  dashboard: "admin" | "manager";
  locale: SupportedLocale;
  filters: OperationsDashboardFilters;
  params: Record<string, string | undefined>;
};

// Special-purpose views retain their complete, independently authorized datasets.
export function usesServerParticipantPage(params: Record<string, string | undefined>) {
  return !params.stat && (!params.view || ["all", "without-group", "deleted"].includes(params.view));
}

function serviceValue(service: Service | undefined): OperationsParticipantRow["service"] {
  return service ? {
    id: service.id, eventId: service.event_id, registrationId: service.registration_id,
    participantId: service.participant_id, serviceId: service.service_id,
    serviceLabel: service.event_services?.label ?? "Servizio senza nome",
    status: ["preference_pending", "proposal_pending", "assigned", "declined"].includes(service.status) ? service.status as NonNullable<OperationsParticipantRow["service"]>["status"] : "assigned",
    source: ["participant_preference", "capogruppo", "manager"].includes(service.source) ? service.source as NonNullable<OperationsParticipantRow["service"]>["source"] : "manager",
    participantNote: service.participant_note ?? null, operatorNote: service.operator_note ?? null, updatedAt: service.updated_at ?? null,
  } : null;
}

/** Called only after the page has authorized Admin or Manager/Viewer for this event.
 * A compact global index stays on the server to preserve the exact existing JS
 * search/collation semantics. Only page details (and an explicitly opened ID) are
 * enriched and serialized. There is no cross-request cache or total-row ceiling. */
export async function loadOperationsParticipantPage(db: SupabaseClient, request: OperationsPageRequest) {
  const { event, params, filters, locale } = request;
  const deleted = request.dashboard === "admin" && params.view === "deleted";
  const preferences = parseTablePreferences({ columns: params.columns?.split(","), sort: params.sort, direction: params.direction });
  if (!request.canManage && preferences.sort === "sex") preferences.sort = "name";
  const [{ data: index }, { data: groups }, { data: tags }, { data: services }] = await Promise.all([
    loadAllRowsConcurrently((from, to) => db.from("registrations").select(
      "id,event_id,participant_id,status,submitted_at,deleted_at,deleted_by,deletion_reason,registration_children(id),participant_group_assignments(id,group_id,status,groups!participant_group_assignments_group_id_fkey(name)),participants(id,auth_user_id,first_name,last_name,birth_date,public_code,country_other,city_other,countries!participants_country_id_fkey(name_it),cities!participants_city_id_fkey(name),participant_contacts(id,email,phone),participant_operational_tags(tag_id,assigned_at,operational_tags!inner(id,event_id,label,color)),participant_event_services(id,event_id,registration_id,participant_id,service_id,status,source,event_services(label)))"
    ).eq("event_id", event.id).filter("deleted_at", deleted ? "not.is" : "is", "null")
      .eq("participants.participant_contacts.is_primary", true)
      .eq("participants.participant_event_services.event_id", event.id)
      .eq("participants.participant_operational_tags.operational_tags.event_id", event.id)
      .eq("participant_group_assignments.is_current", true)
      .order("id").range(from, to)),
    loadAllRows((from, to) => db.from("groups").select("id,event_id,name").eq("event_id", event.id).eq("is_active", true).eq("is_assignable", true).order("name").order("id").range(from, to)),
    loadAllRows((from, to) => db.from("operational_tags").select("id,event_id,label,color").eq("event_id", event.id).order("label").order("id").range(from, to)),
    loadAllRows((from, to) => db.from("event_services").select("id,event_id,label,description,is_active,public_order").eq("event_id", event.id).order("public_order").order("label").order("id").range(from, to)),
  ]);
  const allRows: OperationsParticipantRow[] = (index as unknown as IndexRow[]).map(registration => {
    const p = registration.participants;
    const geography = participantGeography(p);
    const contact = [...(p?.participant_contacts ?? [])].sort((a, b) => a.id.localeCompare(b.id)).at(-1);
    const assignment = [...registration.participant_group_assignments].sort((a, b) => a.id.localeCompare(b.id)).at(-1);
    const service = serviceValue([...(p?.participant_event_services ?? [])].sort((a, b) => a.id.localeCompare(b.id)).at(-1));
    const participantTags = [...(p?.participant_operational_tags ?? [])].sort((a, b) => a.tag_id.localeCompare(b.tag_id)).flatMap(row => row.operational_tags ? [{
      id: row.operational_tags.id, eventId: row.operational_tags.event_id, label: row.operational_tags.label,
      color: row.operational_tags.color, assignedAt: row.assigned_at,
    }] : []);
    return {
      registrationId: registration.id, eventId: event.id, eventTitle: event.title,
      participantId: registration.participant_id, authUserId: p?.auth_user_id ?? null,
      firstName: p?.first_name ?? null, lastName: p?.last_name ?? null,
      name: [p?.first_name, p?.last_name].filter(Boolean).join(" ").trim() || "Partecipante senza nome",
      publicCode: p?.public_code ?? null, birthDate: p?.birth_date ?? null,
      country: geography.country, city: geography.city,
      place: [geography.city, geography.country].filter(Boolean).join(", ") || "Provenienza non indicata",
      email: contact?.email ?? null, phone: contact?.phone ?? null,
      registrationStatus: registration.status, submittedAt: registration.submitted_at,
      deletedAt: registration.deleted_at, deletedBy: registration.deleted_by, deletionReason: registration.deletion_reason,
      currentGroupId: assignment?.group_id ?? null, currentGroupName: assignment?.groups?.name ?? null, currentGroupStatus: assignment?.status ?? null,
      currentServiceId: service?.serviceId ?? null, currentServiceStatus: service?.status ?? null, service,
      tags: participantTags, tagIds: participantTags.map(tag => tag.id), childrenCount: registration.registration_children.length, children: [],
    };
  });
  const filtered = applyOperationsDashboardFilters(allRows, filters).filter(row => params.view !== "without-group" || !row.currentGroupId);
  const sortIds = filtered.map(row => row.registrationId);
  // Only the requested sort column may need a global auxiliary projection.
  const [sortQuestionnaire, sortAttendance, sortAccessibility, sortSexes] = await Promise.all([
    ["nationality", "association"].includes(preferences.sort) ? loadQuestionnaireSummaries(db, sortIds) : null,
    preferences.sort === "attendance" ? loadAttendanceSummaries(db, sortIds) : null,
    preferences.sort === "accessibility" ? loadAccessibilitySummaries(db, sortIds) : null,
    preferences.sort === "sex" && preferences.columns.includes("sex") && params.view !== "without-group" && request.canManage && !deleted ? loadInternalSexes(db, sortIds, request.actorId) : null,
  ]);
  for (const row of filtered) {
    if (sortQuestionnaire) { row.nationality = sortQuestionnaire.nationalities.get(row.registrationId); row.association = sortQuestionnaire.associations.get(row.registrationId); }
    if (sortAttendance) row.attendance = sortAttendance.get(row.registrationId) ?? [];
    if (sortAccessibility) row.accessibility = sortAccessibility.get(row.registrationId);
  }
  const ordered = sortOperationsParticipants(filtered, preferences, event.starts_on ?? null, locale, id => internalSexText(sortSexes?.[id], locale));
  const { rows, ...page } = paginateParticipants(ordered, params.participantPage ?? null);
  const selected = allRows.find(row => row.registrationId === params.edit);
  const detailRows = selected && !rows.some(row => row.registrationId === selected.registrationId) ? [...rows, selected] : rows;
  const ids = detailRows.map(row => row.registrationId);
  const [questionnaire, attendance, accessibility, { data: children }, { data: details }, identities] = await Promise.all([
    loadQuestionnaireSummaries(db, ids),
    loadAttendanceSummaries(db, ids),
    loadAccessibilitySummaries(db, ids),
    loadRowsForIds(ids, (batch, from, to) => db.from("registration_children").select("id,registration_id,first_name,last_name,birth_date,position").in("registration_id", batch).order("id").range(from, to)),
    loadRowsForIds(detailRows.map(row => row.participantId), (batch, from, to) => db.from("participant_event_services").select("id,event_id,registration_id,participant_id,service_id,status,source,participant_note,operator_note,updated_at,event_services(label)").eq("event_id", event.id).in("participant_id", batch).order("id").range(from, to)),
    request.dashboard === "admin" ? getOperationalUserIdentities(db, detailRows.flatMap(row => row.deletedBy ? [row.deletedBy] : [])) : new Map(),
  ]);
  const serviceByParticipant = new Map((details as unknown as Service[]).map(row => [row.participant_id, serviceValue(row)]));
  const childrenByRegistration = new Map<string, OperationsRegistrationChild[]>();
  for (const child of children) {
    const records = childrenByRegistration.get(child.registration_id) ?? [];
    records.push(child); childrenByRegistration.set(child.registration_id, records);
  }
  for (const row of detailRows) {
    row.nationality = questionnaire.nationalities.get(row.registrationId);
    row.association = questionnaire.associations.get(row.registrationId);
    row.emailDelegated = questionnaire.emailDelegations.has(row.registrationId);
    row.attendance = attendance.get(row.registrationId) ?? [];
    row.accessibility = accessibility.get(row.registrationId);
    row.children = (childrenByRegistration.get(row.registrationId) ?? []).sort((a, b) => a.position - b.position);
    row.service = serviceByParticipant.get(row.participantId) ?? null;
    row.deletedByName = row.deletedBy ? identities.get(row.deletedBy)?.fullName ?? identities.get(row.deletedBy)?.email ?? null : null;
  }
  const snapshot: OperationsParticipantsSnapshot = {
    participants: rows, allParticipants: detailRows, filters,
    groupOptions: groups.map(group => ({ id: group.id, eventId: group.event_id, name: group.name ?? "Gruppo senza nome" })),
    operationalTags: tags.map(tag => ({ id: tag.id, eventId: tag.event_id, label: tag.label, color: tag.color })),
    eventServices: services.map(service => ({ id: service.id, eventId: service.event_id, label: service.label ?? "Servizio senza nome", description: service.description, isActive: service.is_active ?? true, publicOrder: service.public_order ?? 100 })),
    serverPage: { ...page, childrenCount: filtered.reduce((sum, row) => sum + row.childrenCount, 0), sort: preferences.sort, direction: preferences.direction, sexColumn: preferences.columns.includes("sex") },
  };
  return { ...snapshot, groupTree: [], groupLinks: [], roleUsers: [], summary: summarizeOperationsDashboardParticipants(allRows, filtered) };
}
