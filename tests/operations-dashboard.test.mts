import assert from "node:assert/strict";
import test from "node:test";

import {
  applyOperationsDashboardFilters,
  applyStatisticsDrilldownToOperations,
  hasActiveOperationsDashboardFilters,
  parseOperationsDashboardFilters,
  summarizeOperationsDashboardParticipants,
  type OperationsParticipantForFilter,
} from "../lib/registrations/operations-dashboard.ts";
import { buildEventStatisticsSnapshot } from "../lib/registrations/event-statistics.ts";

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
    tagIds: ["tag-pranzo"],
    currentServiceId: "servizio-accoglienza",
    currentServiceStatus: "assigned",
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
    tagIds: ["tag-bus"],
    currentServiceId: "servizio-mobilita",
    currentServiceStatus: "proposal_pending",
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
    tagIds: [],
  }),
];

test("parseOperationsDashboardFilters normalizes invalid and long inputs", () => {
  const filters = parseOperationsDashboardFilters({
    q: `  ${"a".repeat(100)}  `,
    contact: "  MARIA@EXAMPLE.ORG  ",
    group: "unknown",
    tag: "tag-pranzo",
    service: "servizio-accoglienza",
    status: "submitted",
  });

  assert.equal(filters.q, "a".repeat(80));
  assert.equal(filters.contact, "MARIA@EXAMPLE.ORG");
  assert.equal(filters.group, "unknown");
  assert.equal(filters.tag, "tag-pranzo");
  assert.equal(filters.service, "servizio-accoglienza");
  assert.equal(filters.status, "submitted");
  assert.equal(hasActiveOperationsDashboardFilters(filters), true);
});

test("applyOperationsDashboardFilters filters by operational tag", () => {
  assert.deepEqual(
    applyOperationsDashboardFilters(
      participants,
      parseOperationsDashboardFilters({ tag: "tag-pranzo" })
    ).map((participant) => participant.name),
    ["Maria Rossi"]
  );

  assert.deepEqual(
    applyOperationsDashboardFilters(
      participants,
      parseOperationsDashboardFilters({ tag: "none" })
    ).map((participant) => participant.name),
    ["Anna Verdi"]
  );
});

test("applyOperationsDashboardFilters filters by event service", () => {
  assert.deepEqual(
    applyOperationsDashboardFilters(
      participants,
      parseOperationsDashboardFilters({ service: "servizio-accoglienza" })
    ).map((participant) => participant.name),
    ["Maria Rossi"]
  );

  assert.deepEqual(
    applyOperationsDashboardFilters(
      participants,
      parseOperationsDashboardFilters({ service: "none" })
    ).map((participant) => participant.name),
    ["Anna Verdi"]
  );
});

test("applyOperationsDashboardFilters searches identity separately from contacts", () => {
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
      parseOperationsDashboardFilters({ contact: "3906123" })
    ).map((participant) => participant.name),
    ["Maria Rossi"]
  );

  assert.deepEqual(
    applyOperationsDashboardFilters(
      participants,
      parseOperationsDashboardFilters({ q: "roma 2027" })
    ).map((participant) => participant.name),
    ["Anna Verdi"]
  );
});

test("applyOperationsDashboardFilters combines contact, group and status", () => {
  assert.deepEqual(
    applyOperationsDashboardFilters(
      participants,
      parseOperationsDashboardFilters({
        contact: "",
        group: "milano",
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
    parseOperationsDashboardFilters({ group: "roma" })
  );

  assert.deepEqual(summarizeOperationsDashboardParticipants(participants, filtered), {
    total: 3,
    filtered: 1,
    withoutGroup: 0,
    probableGroup: 0,
    confirmedGroup: 1,
    withoutEmail: 0,
    withoutService: 0,
  });
});

test("operations summary counts children as registered people", () => {
  const family = participant({
    name: "Famiglia Rossi",
    childrenCount: 3,
    currentGroupId: "roma",
    currentGroupStatus: "confirmed",
  });
  const summary = summarizeOperationsDashboardParticipants([family], [family]);

  assert.equal(summary.total, 4);
  assert.equal(summary.filtered, 4);
  assert.equal(summary.confirmedGroup, 4);
});

test("statistics drilldown opens the registrations containing matching people", () => {
  const operationsRows = [
    { ...participant({ name: "Famiglia Rossi" }), registrationId: "registration-a" },
    { ...participant({ name: "Luca Bianchi" }), registrationId: "registration-b" },
  ];
  const statistics = buildEventStatisticsSnapshot({
    participants: [
      {
        registrationId: "registration-a",
        eventId: "assisi",
        eventTitle: "Assisi 2026",
        name: "Famiglia Rossi",
        currentGroupId: null,
        currentGroupName: null,
        country: "Italia",
        city: "Roma",
        childrenCount: 1,
        children: [
          {
            id: "child-a",
            firstName: "Anna",
            lastName: "Rossi",
            birthDate: "2016-01-01",
            position: 0,
          },
        ],
      },
      {
        registrationId: "registration-b",
        eventId: "assisi",
        eventTitle: "Assisi 2026",
        name: "Luca Bianchi",
        currentGroupId: null,
        currentGroupName: null,
        country: "Francia",
        city: "Parigi",
      },
    ],
    groups: [],
    attendanceChoices: [],
  });
  const selection = applyStatisticsDrilldownToOperations(
    operationsRows,
    statistics,
    { country: "Italia", personKind: "child" }
  );

  assert.deepEqual(
    selection.participants.map((row) => row.registrationId),
    ["registration-a"]
  );
  assert.equal(selection.summary.peopleCount, 1);
  assert.equal(selection.summary.registrationCount, 1);
  assert.equal(selection.summary.label, "Minori accompagnati · Paese: Italia");
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
    tagIds: [],
    currentServiceId: null,
    currentServiceStatus: null,
    ...overrides,
  };
}
