export type StatisticsParticipant = {
  registrationId: string;
  eventId: string;
  eventTitle: string;
  currentGroupId: string | null;
  currentGroupName: string | null;
  country: string | null;
  city: string | null;
};

export type StatisticsGroup = {
  id: string;
  eventId: string;
  name: string;
  parentGroupId: string | null;
  nodeType: string | null;
};

export type StatisticsAttendanceChoice = {
  registration_id: string;
  day: string | null;
  choice: string | null;
};

export type ParticipantBreakdownLevel = "country" | "city" | "group";

export type ParticipantBreakdownRow = {
  id: string;
  label: string;
  eventTitle: string;
  participantCount: number;
};

export type AttendanceDayRow = {
  id: string;
  label: string;
  eventTitle: string;
  participantCount: number;
  kind: "day" | "missing";
};

export type EventStatisticsSnapshot = {
  participantBreakdowns: Record<ParticipantBreakdownLevel, ParticipantBreakdownRow[]>;
  attendanceByDay: AttendanceDayRow[];
};

type GroupNode = StatisticsGroup & {
  parentGroupId: string | null;
};

export function buildEventStatisticsSnapshot({
  participants,
  groups,
  attendanceChoices,
}: {
  participants: StatisticsParticipant[];
  groups: StatisticsGroup[];
  attendanceChoices: StatisticsAttendanceChoice[];
}): EventStatisticsSnapshot {
  return {
    participantBreakdowns: {
      country: buildParticipantBreakdown(participants, groups, "country"),
      city: buildParticipantBreakdown(participants, groups, "city"),
      group: buildParticipantBreakdown(participants, groups, "group"),
    },
    attendanceByDay: buildAttendanceByDay(participants, attendanceChoices),
  };
}

function buildParticipantBreakdown(
  participants: StatisticsParticipant[],
  groups: StatisticsGroup[],
  level: ParticipantBreakdownLevel
): ParticipantBreakdownRow[] {
  const groupsById = new Map<string, GroupNode>(
    groups.map((group) => [group.id, { ...group, parentGroupId: group.parentGroupId }])
  );
  const rowsByKey = new Map<string, ParticipantBreakdownRow>();

  for (const participant of participants) {
    const bucket = getParticipantBucket(participant, groupsById, level);
    const key = `${participant.eventId}:${bucket.id}`;
    const existing = rowsByKey.get(key);

    if (existing) {
      existing.participantCount += 1;
    } else {
      rowsByKey.set(key, {
        id: key,
        label: bucket.label,
        eventTitle: participant.eventTitle,
        participantCount: 1,
      });
    }
  }

  return [...rowsByKey.values()].sort(compareBreakdownRows);
}

function getParticipantBucket(
  participant: StatisticsParticipant,
  groupsById: Map<string, GroupNode>,
  level: ParticipantBreakdownLevel
): { id: string; label: string } {
  if (level === "group") {
    return participant.currentGroupId
      ? {
          id: participant.currentGroupId,
          label: participant.currentGroupName ?? "Gruppo senza nome",
        }
      : { id: "missing-group", label: "Senza gruppo corrente" };
  }

  const node = participant.currentGroupId
    ? findAncestorByType(groupsById, participant.currentGroupId, level)
    : null;

  if (node) {
    return { id: node.id, label: node.name };
  }

  if (level === "country") {
    return participant.country
      ? { id: `country:${normalizeBucketId(participant.country)}`, label: participant.country }
      : { id: "missing-country", label: "Paese non indicato" };
  }

  return participant.city
    ? { id: `city:${normalizeBucketId(participant.city)}`, label: participant.city }
    : { id: "missing-city", label: "Città non indicata" };
}

function findAncestorByType(
  groupsById: Map<string, GroupNode>,
  groupId: string,
  nodeType: "country" | "city"
): GroupNode | null {
  const visited = new Set<string>();
  let current: GroupNode | undefined = groupsById.get(groupId);

  while (current && !visited.has(current.id)) {
    if (current.nodeType === nodeType) {
      return current;
    }

    visited.add(current.id);
    current = current.parentGroupId ? groupsById.get(current.parentGroupId) : undefined;
  }

  return null;
}

function buildAttendanceByDay(
  participants: StatisticsParticipant[],
  attendanceChoices: StatisticsAttendanceChoice[]
): AttendanceDayRow[] {
  const participantsByRegistrationId = new Map(
    participants.map((participant) => [participant.registrationId, participant])
  );
  const yesDaysByRegistrationId = new Map<string, Set<string>>();
  const dayRowsByKey = new Map<string, AttendanceDayRow>();

  for (const choice of attendanceChoices) {
    if (choice.choice !== "yes" || !choice.day) {
      continue;
    }

    const participant = participantsByRegistrationId.get(choice.registration_id);

    if (!participant) {
      continue;
    }

    const selectedDays =
      yesDaysByRegistrationId.get(choice.registration_id) ?? new Set<string>();
    selectedDays.add(choice.day);
    yesDaysByRegistrationId.set(choice.registration_id, selectedDays);

    const key = `${participant.eventId}:${choice.day}`;
    const existing = dayRowsByKey.get(key);

    if (existing) {
      existing.participantCount += 1;
    } else {
      dayRowsByKey.set(key, {
        id: key,
        label: choice.day,
        eventTitle: participant.eventTitle,
        participantCount: 1,
        kind: "day",
      });
    }
  }

  const missingRowsByEventId = new Map<string, AttendanceDayRow>();

  for (const participant of participants) {
    const selectedDays = yesDaysByRegistrationId.get(participant.registrationId);

    if (selectedDays && selectedDays.size > 0) {
      continue;
    }

    const existing = missingRowsByEventId.get(participant.eventId);

    if (existing) {
      existing.participantCount += 1;
    } else {
      missingRowsByEventId.set(participant.eventId, {
        id: `${participant.eventId}:missing`,
        label: "Nessun giorno indicato",
        eventTitle: participant.eventTitle,
        participantCount: 1,
        kind: "missing",
      });
    }
  }

  return [...dayRowsByKey.values(), ...missingRowsByEventId.values()].sort(
    compareAttendanceRows
  );
}

function compareBreakdownRows(
  first: ParticipantBreakdownRow,
  second: ParticipantBreakdownRow
): number {
  return (
    second.participantCount - first.participantCount ||
    first.eventTitle.localeCompare(second.eventTitle, "it") ||
    first.label.localeCompare(second.label, "it")
  );
}

function compareAttendanceRows(first: AttendanceDayRow, second: AttendanceDayRow): number {
  if (first.eventTitle !== second.eventTitle) {
    return first.eventTitle.localeCompare(second.eventTitle, "it");
  }

  if (first.kind !== second.kind) {
    return first.kind === "day" ? -1 : 1;
  }

  return first.label.localeCompare(second.label, "it");
}

function normalizeBucketId(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
