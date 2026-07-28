export type OperationsParticipantForFilter = {
  eventId: string;
  eventTitle: string;
  name: string;
  publicCode: string | null;
  place: string;
  email: string | null;
  phone: string | null;
  registrationStatus: string | null;
  currentGroupId: string | null;
  currentGroupName: string | null;
  currentGroupStatus: string | null;
  tagIds?: string[];
  currentServiceId?: string | null;
  currentServiceStatus?: string | null;
  childrenCount?: number;
};

export type OperationsDashboardFilters = {
  q: string;
  contact: string;
  group: string;
  tag: string;
  service: string;
  status: "all" | "submitted" | "confirmed" | "cancelled";
};

export type OperationsDashboardSummary = {
  total: number;
  filtered: number;
  withoutGroup: number;
  probableGroup: number;
  confirmedGroup: number;
  withoutEmail: number;
  withoutService: number;
};

const DEFAULT_FILTERS: OperationsDashboardFilters = {
  q: "",
  contact: "",
  group: "all",
  tag: "all",
  service: "all",
  status: "all",
};

export function parseOperationsDashboardFilters(input: {
  q?: string;
  contact?: string;
  group?: string;
  tag?: string;
  service?: string;
  status?: string;
}): OperationsDashboardFilters {
  return {
    q: normalizeQuery(input.q),
    contact: normalizeQuery(input.contact),
    group: normalizeGroupFilter(input.group),
    tag: normalizeTagFilter(input.tag),
    service: normalizeServiceFilter(input.service),
    status: isStatusFilter(input.status)
      ? input.status
      : DEFAULT_FILTERS.status,
  };
}

export function applyOperationsDashboardFilters<
  T extends OperationsParticipantForFilter,
>(participants: T[], filters: OperationsDashboardFilters): T[] {
  return participants.filter((participant) =>
    matchesOperationsDashboardFilters(participant, filters)
  );
}

export function summarizeOperationsDashboardParticipants(
  allParticipants: OperationsParticipantForFilter[],
  filteredParticipants: OperationsParticipantForFilter[]
): OperationsDashboardSummary {
  return {
    total: countRegisteredPeople(allParticipants),
    filtered: countRegisteredPeople(filteredParticipants),
    withoutGroup: countRegisteredPeople(
      filteredParticipants.filter((participant) => !participant.currentGroupId)
    ),
    probableGroup: countRegisteredPeople(
      filteredParticipants.filter(
        (participant) => participant.currentGroupStatus === "probable"
      )
    ),
    confirmedGroup: countRegisteredPeople(
      filteredParticipants.filter(
        (participant) => participant.currentGroupStatus === "confirmed"
      )
    ),
    withoutEmail: filteredParticipants.filter((participant) => !participant.email)
      .length,
    withoutService: filteredParticipants.filter(
      (participant) => !participant.currentServiceId
    ).length,
  };
}

function countRegisteredPeople(
  participants: OperationsParticipantForFilter[]
): number {
  return participants.reduce(
    (total, participant) =>
      total + 1 + Math.max(0, participant.childrenCount ?? 0),
    0
  );
}

export function hasActiveOperationsDashboardFilters(
  filters: OperationsDashboardFilters
): boolean {
  return (
    filters.q !== DEFAULT_FILTERS.q ||
    filters.contact !== DEFAULT_FILTERS.contact ||
    filters.group !== DEFAULT_FILTERS.group ||
    filters.tag !== DEFAULT_FILTERS.tag ||
    filters.service !== DEFAULT_FILTERS.service ||
    filters.status !== DEFAULT_FILTERS.status
  );
}

function matchesOperationsDashboardFilters(
  participant: OperationsParticipantForFilter,
  filters: OperationsDashboardFilters
): boolean {
  if (
    filters.status !== "all" &&
    participant.registrationStatus !== filters.status
  ) {
    return false;
  }

  if (!matchesGroupFilter(participant, filters.group)) {
    return false;
  }

  if (!matchesTagFilter(participant, filters.tag)) {
    return false;
  }

  if (!matchesServiceFilter(participant, filters.service)) {
    return false;
  }

  if (filters.contact) {
    const contactHaystack = [participant.email, participant.phone]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (!contactHaystack.includes(filters.contact.toLowerCase())) {
      return false;
    }
  }

  if (!filters.q) {
    return true;
  }

  const haystack = [
    participant.name,
    participant.publicCode,
    participant.place,
    participant.eventTitle,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(filters.q.toLowerCase());
}

function matchesGroupFilter(participant: OperationsParticipantForFilter, filter: string): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "none") {
    return !participant.currentGroupId;
  }

  return participant.currentGroupId === filter;
}

function matchesTagFilter(participant: OperationsParticipantForFilter, filter: string): boolean {
  const tagIds = participant.tagIds ?? [];

  if (filter === "all") {
    return true;
  }

  if (filter === "none") {
    return tagIds.length === 0;
  }

  return tagIds.includes(filter);
}

function matchesServiceFilter(participant: OperationsParticipantForFilter, filter: string): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "none") {
    return !participant.currentServiceId;
  }

  return participant.currentServiceId === filter;
}

function normalizeQuery(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
}

function normalizeGroupFilter(value: string | undefined): string {
  const normalized = (value ?? "").trim();

  return normalized || DEFAULT_FILTERS.group;
}

function normalizeTagFilter(value: string | undefined): string {
  const normalized = (value ?? "").trim();

  return normalized || DEFAULT_FILTERS.tag;
}

function normalizeServiceFilter(value: string | undefined): string {
  const normalized = (value ?? "").trim();

  return normalized || DEFAULT_FILTERS.service;
}

function isStatusFilter(
  value: string | undefined
): value is OperationsDashboardFilters["status"] {
  return (
    value === "all" ||
    value === "submitted" ||
    value === "confirmed" ||
    value === "cancelled"
  );
}
