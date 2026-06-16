export type EventOpeningInput = {
  status: string | null;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
};

export type OpeningState =
  | "open"
  | "scheduled"
  | "closed"
  | "not-published";

export type RegistrationMonitoringInput = {
  submittedAt: string | null;
  status: string | null;
  currentAssignmentStatus: string | null;
  currentAssignmentSource: string | null;
  currentAssignmentReason: string | null;
  hasCurrentAssignment: boolean;
  hasQrToken: boolean;
  needsOperationalSupport: boolean;
  email: string | null;
};

export type RegistrationMonitoringSummary = {
  total: number;
  submitted: number;
  cancelled: number;
  last24Hours: number;
  withoutCurrentGroup: number;
  probableGroup: number;
  participantSelectedGroup: number;
  ruleMatchedGroup: number;
  newcomerGroup: number;
  missingQrToken: number;
  needsOperationalSupport: number;
  duplicateContactEmails: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function getOpeningState(
  event: EventOpeningInput,
  now = new Date()
): OpeningState {
  if (event.status !== "published") {
    return "not-published";
  }

  const opensAt = parseDate(event.registration_opens_at);
  const closesAt = parseDate(event.registration_closes_at);

  if (opensAt && opensAt.getTime() > now.getTime()) {
    return "scheduled";
  }

  if (closesAt && closesAt.getTime() < now.getTime()) {
    return "closed";
  }

  return "open";
}

export function isRegistrationAcceptingEvent(
  event: EventOpeningInput,
  now = new Date()
): boolean {
  return getOpeningState(event, now) === "open";
}

export function summarizeRegistrationMonitoring(
  rows: RegistrationMonitoringInput[],
  now = new Date()
): RegistrationMonitoringSummary {
  const duplicateEmails = countDuplicateEmails(rows.map((row) => row.email));
  const last24Start = now.getTime() - DAY_MS;

  return rows.reduce<RegistrationMonitoringSummary>(
    (summary, row) => {
      const submittedAt = parseDate(row.submittedAt);

      summary.total += 1;

      if (row.status === "cancelled") {
        summary.cancelled += 1;
      } else {
        summary.submitted += 1;
      }

      if (submittedAt && submittedAt.getTime() >= last24Start) {
        summary.last24Hours += 1;
      }

      if (!row.hasCurrentAssignment) {
        summary.withoutCurrentGroup += 1;
      }

      if (row.currentAssignmentStatus === "probable") {
        summary.probableGroup += 1;
      }

      if (row.currentAssignmentSource === "participant_selected") {
        summary.participantSelectedGroup += 1;
      }

      if (row.currentAssignmentSource === "rule") {
        summary.ruleMatchedGroup += 1;
      }

      if (row.currentAssignmentReason === "newcomer") {
        summary.newcomerGroup += 1;
      }

      if (!row.hasQrToken) {
        summary.missingQrToken += 1;
      }

      if (row.needsOperationalSupport) {
        summary.needsOperationalSupport += 1;
      }

      return summary;
    },
    {
      total: 0,
      submitted: 0,
      cancelled: 0,
      last24Hours: 0,
      withoutCurrentGroup: 0,
      probableGroup: 0,
      participantSelectedGroup: 0,
      ruleMatchedGroup: 0,
      newcomerGroup: 0,
      missingQrToken: 0,
      needsOperationalSupport: 0,
      duplicateContactEmails: duplicateEmails,
    }
  );
}

export function openingStateLabel(state: OpeningState): string {
  switch (state) {
    case "open":
      return "Aperte";
    case "scheduled":
      return "Programmate";
    case "closed":
      return "Chiuse";
    case "not-published":
      return "Non pubblicato";
  }
}

function parseDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function countDuplicateEmails(values: Array<string | null>): number {
  const counts = new Map<string, number>();

  for (const value of values) {
    const email = value?.trim().toLowerCase();

    if (!email) {
      continue;
    }

    counts.set(email, (counts.get(email) ?? 0) + 1);
  }

  return [...counts.values()].filter((count) => count > 1).length;
}
