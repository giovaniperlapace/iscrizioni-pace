import type { ParticipantOperationalTag } from "../registrations/operational-tags.ts";
import type { ParticipantEventService } from "../registrations/event-services.ts";
export type AssignmentCopy = {
  groupFallback: string;
  participantFallback: string;
  notProvided: string;
};
type RegistrationChildRelationRow = {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  position: number;
};

export type AssignmentRow = {
  id: string;
  registration_id: string;
  group_id: string;
  status: string | null;
  source: string | null;
  confidence: number | null;
  is_current: boolean | null;
  assignment_reason: string | null;
  escalation_depth: number | null;
  leader_internal_note: string | null;

  leader_decision_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  groups:
    | {
        id: string;
        name: string | null;
        node_type: string | null;
        parent_group_id: string | null;
        is_assignable: boolean | null;
      }
    | Array<{
        id: string;
        name: string | null;
        node_type: string | null;
        parent_group_id: string | null;
        is_assignable: boolean | null;
      }>
    | null;
  registrations:
    | {
        id: string;
        event_id: string;
        status: string | null;
        submitted_at: string | null;
        registration_children: RegistrationChildRelationRow[] | null;
        participants:
          | {
              id: string;
              first_name: string | null;
              last_name: string | null;
              public_code: string | null;
              birth_date: string | null;
              country_other: string | null;
              city_other: string | null;
              participant_contacts: Array<{
                email: string | null;
                phone: string | null;
                is_primary: boolean | null;
              }> | null;
              countries:
                | { name_it: string | null }
                | Array<{ name_it: string | null }>
                | null;
              cities:
                { name: string | null } | Array<{ name: string | null }> | null;
              participates_with_group: boolean | null;
              participant_event_services: Array<ParticipantEventServiceRelationRow> | null;
              participant_operational_tags: Array<{
                assigned_at: string | null;
                operational_tags:
                  | {
                      id: string;
                      event_id: string;
                      label: string;
                      color: string;
                    }
                  | Array<{
                      id: string;
                      event_id: string;
                      label: string;
                      color: string;
                    }>
                  | null;
              }> | null;
            }
          | Array<{
              id: string;
              first_name: string | null;
              last_name: string | null;
              public_code: string | null;
              birth_date: string | null;
              country_other: string | null;
              city_other: string | null;
              participant_contacts: Array<{
                email: string | null;
                phone: string | null;
                is_primary: boolean | null;
              }> | null;
              countries:
                | { name_it: string | null }
                | Array<{ name_it: string | null }>
                | null;
              cities:
                { name: string | null } | Array<{ name: string | null }> | null;
              participates_with_group: boolean | null;
              participant_event_services: Array<ParticipantEventServiceRelationRow> | null;
              participant_operational_tags: Array<{
                assigned_at: string | null;
                operational_tags:
                  | {
                      id: string;
                      event_id: string;
                      label: string;
                      color: string;
                    }
                  | Array<{
                      id: string;
                      event_id: string;
                      label: string;
                      color: string;
                    }>
                  | null;
              }> | null;
            }>
          | null;
      }
    | Array<{
        id: string;
        event_id: string;
        status: string | null;
        submitted_at: string | null;
        registration_children: RegistrationChildRelationRow[] | null;
        participants:
          | {
              id: string;
              first_name: string | null;
              last_name: string | null;
              public_code: string | null;
              birth_date: string | null;
              country_other: string | null;
              city_other: string | null;
              participant_contacts: Array<{
                email: string | null;
                phone: string | null;
                is_primary: boolean | null;
              }> | null;
              countries:
                | { name_it: string | null }
                | Array<{ name_it: string | null }>
                | null;
              cities:
                { name: string | null } | Array<{ name: string | null }> | null;
              participates_with_group: boolean | null;
              participant_event_services: Array<ParticipantEventServiceRelationRow> | null;
              participant_operational_tags: Array<{
                assigned_at: string | null;
                operational_tags:
                  | {
                      id: string;
                      event_id: string;
                      label: string;
                      color: string;
                    }
                  | Array<{
                      id: string;
                      event_id: string;
                      label: string;
                      color: string;
                    }>
                  | null;
              }> | null;
            }
          | Array<{
              id: string;
              first_name: string | null;
              last_name: string | null;
              public_code: string | null;
              birth_date: string | null;
              country_other: string | null;
              city_other: string | null;
              participant_contacts: Array<{
                email: string | null;
                phone: string | null;
                is_primary: boolean | null;
              }> | null;
              countries:
                | { name_it: string | null }
                | Array<{ name_it: string | null }>
                | null;
              cities:
                { name: string | null } | Array<{ name: string | null }> | null;
              participates_with_group: boolean | null;
              participant_event_services: Array<ParticipantEventServiceRelationRow> | null;
              participant_operational_tags: Array<{
                assigned_at: string | null;
                operational_tags:
                  | {
                      id: string;
                      event_id: string;
                      label: string;
                      color: string;
                    }
                  | Array<{
                      id: string;
                      event_id: string;
                      label: string;
                      color: string;
                    }>
                  | null;
              }> | null;
            }>
          | null;
      }>
    | null;
};

export type AssignmentView = {
  id: string;
  registrationId: string;
  eventId: string;
  participantId: string;
  groupId: string;
  groupName: string;
  groupNodeType: string | null;
  groupIsAssignable: boolean;
  parentGroupId: string | null;
  parentGroupName: string | null;
  participantFirstName: string | null;
  participantLastName: string | null;
  participantName: string;
  participantCode: string | null;
  participantEmail: string | null;
  participantPhone: string | null;
  participantCity: string | null;
  participantCountry: string | null;
  participantPlace: string;
  birthDate: string | null;
  registrationStatus: string | null;
  submittedAt: string | null;
  status: string | null;
  source: string | null;
  confidence: number | null;
  isCurrent: boolean;
  assignmentReason: string | null;
  escalationDepth: number;
  leaderInternalNote: string | null;

  leaderDecisionAt: string | null;
  updatedAt: string | null;
  tags: ParticipantOperationalTag[];
  tagIds: string[];
  service: ParticipantEventService | null;
  currentServiceId: string | null;
  currentServiceStatus: string | null;
  children: RegistrationChildRelationRow[];
};

type ParticipantEventServiceRelationRow = {
  id: string;
  event_id: string;
  registration_id: string;
  participant_id: string;
  service_id: string;
  status: string | null;
  source: string | null;
  participant_note: string | null;
  operator_note: string | null;
  updated_at: string | null;
  event_services:
    { label: string | null } | Array<{ label: string | null }> | null;
};
export function toAssignmentView(
  row: AssignmentRow,
  copy: AssignmentCopy,
  groups: { id: string; name: string }[],
): AssignmentView | null {
  const registration = relatedOne(row.registrations);
  const participant = relatedOne(registration?.participants ?? null);
  const group = relatedOne(row.groups);

  if (!registration || !participant || !group) {
    return null;
  }

  const tags = mapParticipantOperationalTags(
    participant.participant_operational_tags,
  ).filter((tag) => tag.eventId === registration.event_id);
  const service = mapParticipantEventService(
    participant.participant_event_services?.filter(
      (service) =>
        service.registration_id === registration.id &&
        service.event_id === registration.event_id,
    ) ?? null,
    participant.id,
  );
  const parentGroup = group.parent_group_id
    ? groups.find((candidate) => candidate.id === group.parent_group_id)
    : null;

  return {
    id: row.id,
    registrationId: row.registration_id,
    eventId: registration.event_id,
    participantId: participant.id,
    groupId: row.group_id,
    groupName: group.name ?? copy.groupFallback,
    groupNodeType: group.node_type,
    groupIsAssignable: group.is_assignable ?? true,
    parentGroupId: group.parent_group_id,
    parentGroupName: parentGroup?.name ?? null,
    participantFirstName: participant.first_name,
    participantLastName: participant.last_name,
    participantName: formatParticipantName(
      participant.first_name,
      participant.last_name,
      copy,
    ),
    participantCode: participant.public_code,
    participantEmail:
      getPrimaryContact(participant.participant_contacts)?.email ?? null,
    participantPhone:
      getPrimaryContact(participant.participant_contacts)?.phone ?? null,
    participantCity:
      relatedOne(participant.cities)?.name ?? participant.city_other,
    participantCountry:
      relatedOne(participant.countries)?.name_it ?? participant.country_other,
    participantPlace: formatPlace(
      relatedOne(participant.cities)?.name ?? participant.city_other,
      relatedOne(participant.countries)?.name_it ?? participant.country_other,
      copy,
    ),
    birthDate: participant.birth_date,
    registrationStatus: registration.status,
    submittedAt: registration.submitted_at,
    status: row.status,
    source: row.source,
    confidence: row.confidence,
    isCurrent: row.is_current ?? true,
    assignmentReason: row.assignment_reason,
    escalationDepth: row.escalation_depth ?? 0,
    leaderInternalNote: row.leader_internal_note,

    leaderDecisionAt: row.leader_decision_at,
    updatedAt: row.updated_at,
    tags,
    tagIds: tags.map((tag) => tag.id),
    service,
    currentServiceId: service?.serviceId ?? null,
    currentServiceStatus: service?.status ?? null,
    children: [...(registration.registration_children ?? [])].sort(
      (first, second) => first.position - second.position,
    ),
  };
}

function formatParticipantName(
  firstName: string | null,
  lastName: string | null,
  copy: AssignmentCopy,
): string {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();

  return name || copy.participantFallback;
}

function getPrimaryContact(
  contacts: Array<{
    email: string | null;
    phone: string | null;
    is_primary: boolean | null;
  }> | null,
): { email: string | null; phone: string | null } | null {
  if (!contacts || contacts.length === 0) {
    return null;
  }

  return contacts.find((contact) => contact.is_primary) ?? contacts[0] ?? null;
}

function mapParticipantOperationalTags(
  rows: Array<{
    assigned_at: string | null;
    operational_tags:
      | {
          id: string;
          event_id: string;
          label: string;
          color: string;
        }
      | Array<{
          id: string;
          event_id: string;
          label: string;
          color: string;
        }>
      | null;
  }> | null,
): ParticipantOperationalTag[] {
  return (rows ?? [])
    .map((row) => {
      const tag = relatedOne(row.operational_tags);

      return tag
        ? {
            id: tag.id,
            eventId: tag.event_id,
            label: tag.label,
            color: tag.color,
            assignedAt: row.assigned_at,
          }
        : null;
    })
    .filter((tag): tag is ParticipantOperationalTag => Boolean(tag));
}

function mapParticipantEventService(
  rows: Array<ParticipantEventServiceRelationRow> | null,
  participantId: string,
): ParticipantEventService | null {
  const row = rows?.[0] ?? null;

  if (!row) {
    return null;
  }

  const service = relatedOne(row.event_services);

  return {
    id: row.id,
    eventId: row.event_id,
    registrationId: row.registration_id,
    participantId,
    serviceId: row.service_id,
    serviceLabel: service?.label ?? "—",
    status:
      row.status === "preference_pending" ||
      row.status === "proposal_pending" ||
      row.status === "assigned" ||
      row.status === "declined"
        ? row.status
        : "assigned",
    source:
      row.source === "participant_preference" ||
      row.source === "capogruppo" ||
      row.source === "manager"
        ? row.source
        : "manager",
    participantNote: row.participant_note,
    operatorNote: row.operator_note,
    updatedAt: row.updated_at,
  };
}

function formatPlace(
  city: string | null,
  country: string | null,
  copy: AssignmentCopy,
): string {
  const parts = [city, country].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : copy.notProvided;
}

function relatedOne<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
