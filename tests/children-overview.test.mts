import assert from "node:assert/strict";
import test from "node:test";
import { buildChildrenOverview } from "../lib/registrations/children-overview.ts";
import type { OperationsParticipantRow } from "../lib/registrations/operations-types.ts";
const row = (id: string, birthDate: string | null, extra = {}) =>
  ({
    registrationId: id,
    eventId: "event",
    birthDate,
    children: [],
    ...extra,
  }) as unknown as OperationsParticipantRow;
const child = (id: string, birth_date: string) => ({
  id,
  birth_date,
  first_name: "Figlio",
  last_name: "Esempio",
  position: 0,
});
test("one row per child retains the exact parent and includes older accompanied children", () => {
  const parent = row("parent", "1980-01-01", {
    children: [child("one", "2020-01-01"), child("two", "2008-01-01")],
  });
  const result = buildChildrenOverview([parent], "event", "2026-10-25");
  assert.equal(result.children.length, 2);
  assert.equal(result.parentsCount, 1);
  assert.equal(result.childrenUnder15, 1);
  assert.equal(result.children[1].parent, parent);
  assert.equal(result.independent.length, 0);
});
test("under 15 uses exact event birthday, regardless of account or own children", () => {
  const result = buildChildrenOverview(
    [
      row("young", "2011-10-26", {
        authUserId: null,
        children: [child("c", "2026-01-01")],
      }),
      row("fifteen", "2011-10-25"),
      row("baby", "2026-10-25"),
    ],
    "event",
    "2026-10-25",
  );
  assert.deepEqual(
    result.independent.map((x) => [x.participant.registrationId, x.age]),
    [
      ["young", 14],
      ["baby", 0],
    ],
  );
  assert.equal(result.children.length, 1);
});
test("missing, invalid and future dates are never treated as children aged zero", () => {
  const rows = [
    row("missing", null),
    row("invalid", "2020-02-30"),
    row("future", "2026-10-26"),
  ];
  const result = buildChildrenOverview(rows, "event", "2026-10-25");
  assert.equal(result.independent.length, 0);
  assert.equal(result.unknownAges, 3);
  assert.equal(
    buildChildrenOverview([row("valid", "2020-01-01")], "event", null)
      .independent.length,
    0,
  );
});
test("deleted registrations and other events never appear in either table", () => {
  const rows = [
    row("deleted", "2020-01-01", {
      deletedAt: "2026-09-01",
      children: [child("a", "2020-01-01")],
    }),
    row("other", "2020-01-01", {
      eventId: "other",
      children: [child("b", "2020-01-01")],
    }),
  ];
  const result = buildChildrenOverview(rows, "event", "2026-10-25");
  assert.equal(
    result.children.length + result.independent.length + result.unknownAges,
    0,
  );
  assert.equal(
    buildChildrenOverview(rows, null, "2026-10-25").children.length,
    0,
  );
});

test("legacy parents with missing birth, city and email retain their registrations and children", () => {
  const parent = row("legacy-parent", null, {
    city: null, email: null, currentGroupId: "germany",
    children: [child("known", "2020-01-01"), child("unknown", "")],
  });
  const before = structuredClone(parent);
  const result = buildChildrenOverview([parent], "event", "2026-10-25");
  assert.equal(result.children.length, 2);
  assert.equal(result.parentsCount, 1);
  assert.equal(result.unknownAges, 1);
  assert.equal(result.independent.length, 0);
  assert.equal(result.children[1].age, null);
  assert.ok(result.children.every(item => item.parent === parent));
  assert.deepEqual(parent, before);
});
