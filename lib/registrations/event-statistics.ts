import {
  buildAttendanceDayColumns,
  parseDateOnly,
} from "./attendance-slots.ts";

export type StatisticsParticipant = {
  registrationId: string;
  eventId: string;
  eventTitle: string;
  name?: string | null;
  birthDate?: string | null;
  currentGroupId: string | null;
  currentGroupName: string | null;
  country: string | null;
  city: string | null;
  childrenCount?: number;
  children?: StatisticsChild[];
};

export type StatisticsChild = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  birthDate: string | null;
  position: number;
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
  day_part?: string | null;
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

export type StatisticsPersonKind = "participant" | "child";

export type StatisticsAgeBand =
  | "0-14"
  | "15-30"
  | "30-65"
  | "65+"
  | "unknown";

export type StatisticsPersonRow = {
  id: string;
  registrationId: string;
  name: string;
  kind: StatisticsPersonKind;
  country: string;
  city: string;
  group: string;
  birthDate: string | null;
  age: number | null;
  ageBand: StatisticsAgeBand;
  attendanceSlotKeys: string[];
  attendanceUnknown: boolean;
};

export type StatisticsAttendanceSlot = {
  key: string;
  day: string;
  dayPart: "morning" | "afternoon" | "day";
};

export type EventStatisticsSnapshot = {
  participantBreakdowns: Record<ParticipantBreakdownLevel, ParticipantBreakdownRow[]>;
  attendanceByDay: AttendanceDayRow[];
  people: StatisticsPersonRow[];
  attendanceSlots: StatisticsAttendanceSlot[];
};

type GroupNode = StatisticsGroup & {
  parentGroupId: string | null;
};

export function buildEventStatisticsSnapshot({
  participants,
  groups,
  attendanceChoices,
  eventStartsOn = null,
  eventEndsOn = null,
}: {
  participants: StatisticsParticipant[];
  groups: StatisticsGroup[];
  attendanceChoices: StatisticsAttendanceChoice[];
  eventStartsOn?: string | null;
  eventEndsOn?: string | null;
}): EventStatisticsSnapshot {
  const detail = buildPeopleDetail(
    participants,
    groups,
    attendanceChoices,
    eventStartsOn,
    eventEndsOn
  );

  return {
    participantBreakdowns: {
      country: buildParticipantBreakdown(participants, groups, "country"),
      city: buildParticipantBreakdown(participants, groups, "city"),
      group: buildParticipantBreakdown(participants, groups, "group"),
    },
    attendanceByDay: buildAttendanceByDay(participants, attendanceChoices),
    people: detail.people,
    attendanceSlots: detail.attendanceSlots,
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
    const peopleCount = getRegisteredPeopleCount(participant);
    const bucket = getParticipantBucket(participant, groupsById, level);
    const key = `${participant.eventId}:${bucket.id}`;
    const existing = rowsByKey.get(key);

    if (existing) {
      existing.participantCount += peopleCount;
    } else {
      rowsByKey.set(key, {
        id: key,
        label: bucket.label,
        eventTitle: participant.eventTitle,
        participantCount: peopleCount,
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

function buildPeopleDetail(
  participants: StatisticsParticipant[],
  groups: StatisticsGroup[],
  attendanceChoices: StatisticsAttendanceChoice[],
  eventStartsOn: string | null,
  eventEndsOn: string | null
): {
  people: StatisticsPersonRow[];
  attendanceSlots: StatisticsAttendanceSlot[];
} {
  const groupsById = new Map<string, GroupNode>(
    groups.map((group) => [group.id, { ...group, parentGroupId: group.parentGroupId }])
  );
  const attendanceByRegistrationId = new Map<
    string,
    { selected: Set<string>; unknown: boolean }
  >();
  const slotsByKey = new Map<string, StatisticsAttendanceSlot>();

  for (const column of buildAttendanceDayColumns(eventStartsOn, eventEndsOn)) {
    for (const part of column.parts) {
      const key = attendanceDetailSlotKey(column.day, part);
      slotsByKey.set(key, { key, day: column.day, dayPart: part });
    }
  }

  for (const choice of attendanceChoices) {
    const current = attendanceByRegistrationId.get(choice.registration_id) ?? {
      selected: new Set<string>(),
      unknown: false,
    };

    if (choice.choice === "unknown") {
      current.unknown = true;
    }

    if (choice.choice === "yes" && choice.day) {
      const dayPart =
        choice.day_part === "morning" || choice.day_part === "afternoon"
          ? choice.day_part
          : "day";
      const key = attendanceDetailSlotKey(choice.day, dayPart);
      current.selected.add(key);
      slotsByKey.set(key, { key, day: choice.day, dayPart });
    }

    attendanceByRegistrationId.set(choice.registration_id, current);
  }

  const people: StatisticsPersonRow[] = [];

  for (const participant of participants) {
    const country = getParticipantBucket(participant, groupsById, "country").label;
    const city = getParticipantBucket(participant, groupsById, "city").label;
    const group = getParticipantBucket(participant, groupsById, "group").label;
    const attendance = attendanceByRegistrationId.get(participant.registrationId);
    const common = {
      registrationId: participant.registrationId,
      country,
      city,
      group,
      attendanceSlotKeys: [...(attendance?.selected ?? [])].sort(),
      attendanceUnknown: attendance?.unknown ?? false,
    };

    people.push(
      buildStatisticsPersonRow({
        ...common,
        id: `participant:${participant.registrationId}`,
        name: participant.name?.trim() || "Partecipante senza nome",
        kind: "participant",
        birthDate: participant.birthDate ?? null,
        ageReferenceDate: eventStartsOn,
      })
    );

    const children = [...(participant.children ?? [])].sort(
      (first, second) => first.position - second.position
    );

    children.forEach((child, index) => {
      const name = [child.firstName, child.lastName]
        .filter((value): value is string => Boolean(value?.trim()))
        .join(" ");

      people.push(
        buildStatisticsPersonRow({
          ...common,
          id: `child:${child.id}`,
          name: name || `Minore accompagnato ${index + 1}`,
          kind: "child",
          birthDate: child.birthDate,
          ageReferenceDate: eventStartsOn,
        })
      );
    });

    const missingChildren = Math.max(
      0,
      (participant.childrenCount ?? children.length) - children.length
    );

    for (let index = 0; index < missingChildren; index += 1) {
      people.push(
        buildStatisticsPersonRow({
          ...common,
          id: `child:${participant.registrationId}:missing:${index}`,
          name: `Minore accompagnato ${children.length + index + 1}`,
          kind: "child",
          birthDate: null,
          ageReferenceDate: eventStartsOn,
        })
      );
    }
  }

  return {
    people: people.sort((first, second) =>
      first.name.localeCompare(second.name, "it", { sensitivity: "base" })
    ),
    attendanceSlots: [...slotsByKey.values()].sort(compareAttendanceSlots),
  };
}

function buildStatisticsPersonRow({
  id,
  registrationId,
  name,
  kind,
  country,
  city,
  group,
  birthDate,
  ageReferenceDate,
  attendanceSlotKeys,
  attendanceUnknown,
}: Omit<StatisticsPersonRow, "age" | "ageBand"> & {
  ageReferenceDate: string | null;
}): StatisticsPersonRow {
  const age = calculateAge(birthDate, ageReferenceDate);

  return {
    id,
    registrationId,
    name,
    kind,
    country,
    city,
    group,
    birthDate,
    age,
    ageBand: getStatisticsAgeBand(age),
    attendanceSlotKeys,
    attendanceUnknown,
  };
}

function calculateAge(birthDate: string | null, referenceDate: string | null): number | null {
  if (!birthDate || !referenceDate) {
    return null;
  }

  const birth = parseDateOnly(birthDate);
  const reference = parseDateOnly(referenceDate);

  if (!birth || !reference || birth.getTime() > reference.getTime()) {
    return null;
  }

  let age = reference.getUTCFullYear() - birth.getUTCFullYear();
  const birthdayHasPassed =
    reference.getUTCMonth() > birth.getUTCMonth() ||
    (reference.getUTCMonth() === birth.getUTCMonth() &&
      reference.getUTCDate() >= birth.getUTCDate());

  if (!birthdayHasPassed) {
    age -= 1;
  }

  return age;
}

function getStatisticsAgeBand(age: number | null): StatisticsAgeBand {
  if (age === null) {
    return "unknown";
  }

  if (age <= 14) {
    return "0-14";
  }

  if (age <= 30) {
    return "15-30";
  }

  if (age < 65) {
    return "30-65";
  }

  return "65+";
}

function attendanceDetailSlotKey(
  day: string,
  dayPart: "morning" | "afternoon" | "day"
): string {
  return `${day}__${dayPart}`;
}

function compareAttendanceSlots(
  first: StatisticsAttendanceSlot,
  second: StatisticsAttendanceSlot
): number {
  if (first.day !== second.day) {
    return first.day.localeCompare(second.day);
  }

  const partOrder = { morning: 0, afternoon: 1, day: 2 };
  return partOrder[first.dayPart] - partOrder[second.dayPart];
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
    const alreadyCountedForDay = selectedDays.has(choice.day);
    selectedDays.add(choice.day);
    yesDaysByRegistrationId.set(choice.registration_id, selectedDays);

    if (alreadyCountedForDay) {
      continue;
    }

    const key = `${participant.eventId}:${choice.day}`;
    const existing = dayRowsByKey.get(key);
    const peopleCount = getRegisteredPeopleCount(participant);

    if (existing) {
      existing.participantCount += peopleCount;
    } else {
      dayRowsByKey.set(key, {
        id: key,
        label: choice.day,
        eventTitle: participant.eventTitle,
        participantCount: peopleCount,
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
    const peopleCount = getRegisteredPeopleCount(participant);

    if (existing) {
      existing.participantCount += peopleCount;
    } else {
      missingRowsByEventId.set(participant.eventId, {
        id: `${participant.eventId}:missing`,
        label: "Nessun giorno indicato",
        eventTitle: participant.eventTitle,
        participantCount: peopleCount,
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

function getRegisteredPeopleCount(participant: StatisticsParticipant): number {
  return 1 + Math.max(0, participant.childrenCount ?? 0);
}
