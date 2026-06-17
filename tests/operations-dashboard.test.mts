import assert from "node:assert/strict";
import test from "node:test";

import {
  applyOperationsDashboardFilters,
  hasActiveOperationsDashboardFilters,
  parseOperationsDashboardFilters,
  summarizeOperationsDashboardParticipants,
  type OperationsParticipantForFilter,
} from "../lib/registrations/operations-dashboard.ts";

const participants: OperationsParticipantForFilter[] = [
  participant({
    eventId: "assisi",
    eventTitle: "Assisi 2026",
    name: "Maria Rossi",
    publicCode: "AB12",
    email: "maria@example.org",
    phone: "+3906123",
    currentGroupId: "roma",
    currentGroupName: "Roma centro",
    currentGroupStatus: "confirmed",
    roles: ["capogruppo"],
  }),
  participant({
    eventId: "assisi",
    eventTitle: "Assisi 2026",
    name: "Luca Bianchi",
    publicCode: "CD34",
    email: null,
    currentGroupId: "milano",
    currentGroupName: "Milano",
    currentGroupStatus: "probable",
  }),
  participant({
    eventId: "roma",
    eventTitle: "Roma 2027",
    name: "Anna Verdi",
    publicCode: "EF56",
    email: "anna@example.org",
    currentGroupId: null,
    currentGroupName: null,
    currentGroupStatus: null,
    registrationStatus: "cancelled",
  }),
];

test("parseOperationsDashboardFilters normalizes invalid and long inputs", () => {
  const filters = parseOperationsDashboardFilters({
    q: `  ${"a".repeat(100)}  `,
    event: "",
    group: "unknown",
    role: "operational",
    status: "submitted",
  });

  assert.equal(filters.q, "a".repeat(80));
  assert.equal(filters.eventId, "all");
  assert.equal(filters.group, "all");
  assert.equal(filters.role, "operational");
  assert.equal(filters.status, "submitted");
  assert.equal(hasActiveOperationsDashboardFilters(filters), true);
});

test("applyOperationsDashboardFilters searches identity, contacts, groups and event", () => {
  assert.deepEqual(
    applyOperationsDashboardFilters(
      participants,
      parseOperationsDashboardFilters({ q: "ab12" })
    ).map((participant) => participant.name),
    ["Maria Rossi"]
  );

  assert.deepEqual(
    applyOperationsDashboardFilters(
      participants,
      parseOperationsDashboardFilters({ q: "milano" })
    ).map((participant) => participant.name),
    ["Luca Bianchi"]
  );

  assert.deepEqual(
    applyOperationsDashboardFilters(
      participants,
      parseOperationsDashboardFilters({ q: "roma 2027" })
    ).map((participant) => participant.name),
    ["Anna Verdi"]
  );
});

test("applyOperationsDashboardFilters combines event, group, role and status", () => {
  assert.deepEqual(
    applyOperationsDashboardFilters(
      participants,
      parseOperationsDashboardFilters({
        event: "assisi",
        group: "probable",
        role: "none",
        status: "submitted",
      })
    ).map((participant) => participant.name),
    ["Luca Bianchi"]
  );

  assert.deepEqual(
    applyOperationsDashboardFilters(
      participants,
      parseOperationsDashboardFilters({
        group: "none",
        status: "cancelled",
      })
    ).map((participant) => participant.name),
    ["Anna Verdi"]
  );
});

test("summarizeOperationsDashboardParticipants reports loaded and filtered rows", () => {
  const filtered = applyOperationsDashboardFilters(
    participants,
    parseOperationsDashboardFilters({ event: "assisi" })
  );

  assert.deepEqual(summarizeOperationsDashboardParticipants(participants, filtered), {
    total: 3,
    filtered: 2,
    withoutGroup: 0,
    probableGroup: 1,
    confirmedGroup: 1,
    operationalRoles: 1,
    withoutEmail: 1,
  });
});

function participant(
  overrides: Partial<OperationsParticipantForFilter>
): OperationsParticipantForFilter {
  return {
    eventId: "assisi",
    eventTitle: "Assisi 2026",
    name: "Partecipante",
    publicCode: null,
    place: "Italia",
    email: "test@example.org",
    phone: null,
    registrationStatus: "submitted",
    currentGroupId: null,
    currentGroupName: null,
    currentGroupStatus: null,
    roles: [],
    ...overrides,
  };
}
