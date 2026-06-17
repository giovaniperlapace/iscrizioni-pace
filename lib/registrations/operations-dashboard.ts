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
};

export type OperationsDashboardFilters = {
  q: string;
  eventId: string;
  group: "all" | "none" | "probable" | "confirmed";
  status: "all" | "submitted" | "confirmed" | "cancelled";
};

export type OperationsDashboardSummary = {
  total: number;
  filtered: number;
  withoutGroup: number;
  probableGroup: number;
  confirmedGroup: number;
  withoutEmail: number;
};

const DEFAULT_FILTERS: OperationsDashboardFilters = {
  q: "",
  eventId: "all",
  group: "all",
  status: "all",
};

export function parseOperationsDashboardFilters(input: {
  q?: string;
  event?: string;
  group?: string;
  status?: string;
}): OperationsDashboardFilters {
  return {
    q: normalizeQuery(input.q),
    eventId: normalizeEventFilter(input.event),
    group: isGroupFilter(input.group) ? input.group : DEFAULT_FILTERS.group,
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
    total: allParticipants.length,
    filtered: filteredParticipants.length,
    withoutGroup: filteredParticipants.filter(
      (participant) => !participant.currentGroupId
    ).length,
    probableGroup: filteredParticipants.filter(
      (participant) => participant.currentGroupStatus === "probable"
    ).length,
    confirmedGroup: filteredParticipants.filter(
      (participant) => participant.currentGroupStatus === "confirmed"
    ).length,
    withoutEmail: filteredParticipants.filter((participant) => !participant.email)
      .length,
  };
}

export function hasActiveOperationsDashboardFilters(
  filters: OperationsDashboardFilters
): boolean {
  return (
    filters.q !== DEFAULT_FILTERS.q ||
    filters.eventId !== DEFAULT_FILTERS.eventId ||
    filters.group !== DEFAULT_FILTERS.group ||
    filters.status !== DEFAULT_FILTERS.status
  );
}

function matchesOperationsDashboardFilters(
  participant: OperationsParticipantForFilter,
  filters: OperationsDashboardFilters
): boolean {
  if (filters.eventId !== "all" && participant.eventId !== filters.eventId) {
    return false;
  }

  if (
    filters.status !== "all" &&
    participant.registrationStatus !== filters.status
  ) {
    return false;
  }

  if (!matchesGroupFilter(participant, filters.group)) {
    return false;
  }

  if (!filters.q) {
    return true;
  }

  const haystack = [
    participant.name,
    participant.publicCode,
    participant.email,
    participant.phone,
    participant.place,
    participant.currentGroupName,
    participant.eventTitle,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(filters.q.toLowerCase());
}

function matchesGroupFilter(
  participant: OperationsParticipantForFilter,
  filter: OperationsDashboardFilters["group"]
): boolean {
  switch (filter) {
    case "none":
      return !participant.currentGroupId;
    case "probable":
      return participant.currentGroupStatus === "probable";
    case "confirmed":
      return participant.currentGroupStatus === "confirmed";
    case "all":
      return true;
  }
}

function normalizeQuery(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
}

function normalizeEventFilter(value: string | undefined): string {
  const normalized = (value ?? "").trim();

  return normalized || DEFAULT_FILTERS.eventId;
}

function isGroupFilter(
  value: string | undefined
): value is OperationsDashboardFilters["group"] {
  return (
    value === "all" ||
    value === "none" ||
    value === "probable" ||
    value === "confirmed"
  );
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
