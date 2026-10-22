import test from "node:test";
import assert from "node:assert/strict";
import {
  parseSectorDirectoryQuery,
  parseLeaderBatch,
  sectorBudget,
} from "../lib/ceremonies/sector-desk.ts";
import { parseDeskCommand } from "../lib/ceremonies/seats-desk.ts";
import { SECTOR_COPY } from "../lib/ceremonies/sector-copy.ts";
const id = (n: number) =>
  `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`;
test("sector directory has explicit group/all/no-group and bounded global pagination", () => {
  const q = {
    planId: id(1),
    groupId: id(2),
    withoutGroup: false,
    search: "Persona",
    page: 2,
  };
  assert.deepEqual(parseSectorDirectoryQuery(q), q);
  for (const change of [
    { page: 0 },
    { page: 1.2 },
    { page: 1000001 },
    { groupId: "other" },
    { withoutGroup: true },
    { search: "x".repeat(201) },
  ])
    assert.equal(parseSectorDirectoryQuery({ ...q, ...change }), null);
  assert.ok(
    parseSectorDirectoryQuery({ ...q, groupId: null, withoutGroup: true }),
  );
});
test("named sector assignments carry group context without binding a numbered chair", () => {
  const c = {
    planId: id(1),
    requestId: id(2),
    revision: 0,
    data: {
      action: "assign",
      sectorId: id(3),
      seatIds: [],
      quantity: 2,
      groupId: id(4),
      subjects: [
        { registrationId: id(5), childId: null },
        { registrationId: id(5), childId: id(6) },
      ],
    },
  };
  assert.deepEqual(parseDeskCommand(c), c);
  assert.equal(
    parseDeskCommand({ ...c, data: { ...c.data, seatIds: [id(7), id(8)] } }),
    null,
  );
});
test("leader batch rejects duplicated or malformed family subjects and keeps an immutable retry identity", () => {
  const c = {
    allocationId: id(1),
    revision: 2,
    requestId: id(2),
    subjects: [
      { registrationId: id(3), childId: null },
      { registrationId: id(3), childId: id(4) },
    ],
  };
  assert.deepEqual(parseLeaderBatch(c), c);
  for (const subjects of [
    [],
    [c.subjects[0], c.subjects[0]],
    [{ registrationId: id(3), childId: "" }],
  ])
    assert.equal(parseLeaderBatch({ ...c, subjects }), null);
  assert.equal(parseLeaderBatch({ ...c, revision: -1 }), null);
});
test("remaining group places count only unused reserve in the selected sector", () => {
  assert.equal(
    sectorBudget(
      {
        reserves: [
          { sectorId: id(1), quantity: 20, used: 7 },
          { sectorId: id(2), quantity: 80, used: 1 },
        ],
      } as never,
      id(1),
    ),
    13,
  );
  assert.equal(sectorBudget(null, id(1)), 0);
});
test("sector selection and attendance declarations are translated in all seven languages", () => {
  assert.equal(Object.keys(SECTOR_COPY).length, 7);
  for (const copy of Object.values(SECTOR_COPY)) {
    assert.deepEqual(Object.keys(copy), Object.keys(SECTOR_COPY.it));
    for (const text of Object.values(copy)) assert.ok(text.trim());
  }
});
