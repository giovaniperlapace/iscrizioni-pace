import test from "node:test";
import assert from "node:assert/strict";
import { rebaseLeaderBatch } from "../lib/ceremonies/leader-batch-retry.ts";
import type { LeaderTickets } from "../lib/ceremonies/leader-tickets.ts";
import type { LeaderBatchCommand } from "../lib/ceremonies/sector-desk.ts";

function fixture() {
  const previous: LeaderTickets = {
    allocations: [{ id: "a", planId: "p", kind: "closing", state: "validated", revision: 7,
      groupId: "g", groupName: "Group", location: "Assisi", startsAt: "2026-10-27T15:15:00Z",
      sector: "Prato", category: "delegations", quantity: 5, used: 1, numbered: false }],
    nominees: [], tickets: [],
    people: [{ registrationId: "r", name: "Adult", code: "TEST", groupIds: ["g"],
      children: [{ id: "child", name: "Child" }], eligiblePlanIds: ["p"], assigned: [] }],
  };
  const command: LeaderBatchCommand = { allocationId: "a", revision: 7, requestId: "original",
    subjects: [{ registrationId: "r", childId: null }, { registrationId: "r", childId: "child" }] };
  const current = structuredClone(previous);
  current.allocations[0].revision = 15;
  return { previous, current, command };
}

test("unrelated ceremony writes allow the complete confirmed family batch with fresh revision", () => {
  const { previous, current, command } = fixture();
  const original = structuredClone(command);
  const retry = rebaseLeaderBatch(command, previous, current, "new-request");
  assert.deepEqual(retry, { ...original, revision: 15, requestId: "new-request" });
  assert.deepEqual(command, original);
  assert.equal(previous.allocations[0].revision, 7);
});

test("a real allocation change requires new confirmation, even with enough capacity", () => {
  for (const change of [
    { groupId: "other" }, { planId: "other" }, { kind: "opening" }, { sector: "Piazza" },
    { quantity: 6 }, { used: 0 }, { state: "draft" }, { numbered: true },
    { location: "Other" }, { startsAt: "2026-10-28T15:15:00Z" }, { badgeCode: "other" },
  ]) {
    const { previous, current, command } = fixture();
    Object.assign(current.allocations[0], change);
    assert.equal(rebaseLeaderBatch(command, previous, current, "new"), null, JSON.stringify(change));
  }
  const { previous, current, command } = fixture();
  current.allocations = [];
  assert.equal(rebaseLeaderBatch(command, previous, current, "new"), null);
});

test("retry never silently removes a selected adult or child or overrides an existing decision", () => {
  const changes: ((view: LeaderTickets) => void)[] = [
    (v) => { v.people = []; },
    (v) => { v.people[0].groupIds = ["another-group"]; },
    (v) => { v.people[0].children = []; },
    (v) => { v.people[0].eligiblePlanIds = []; },
    (v) => { v.people[0].name = "Different adult"; },
    (v) => { v.people[0].children[0].name = "Different child"; },
    (v) => { v.people[0].assigned = [{ planId: "p", childId: null, needsSeat: true }]; },
    (v) => { v.people[0].assigned = [{ planId: "p", childId: "child", needsSeat: false }]; },
  ];
  for (const change of changes) {
    const { previous, current, command } = fixture();
    change(current);
    assert.equal(rebaseLeaderBatch(command, previous, current, "new"), null);
  }
});

test("retry requires an advanced canonical revision and the complete original snapshot", () => {
  for (const revision of [7, 6, NaN, 15.5, 2147483647]) {
    const { previous, current, command } = fixture();
    current.allocations[0].revision = revision;
    assert.equal(rebaseLeaderBatch(command, previous, current, "new"), null);
  }
  const { previous, current, command } = fixture();
  previous.allocations[0].revision = 6;
  assert.equal(rebaseLeaderBatch(command, previous, current, "new"), null);
});

test("insufficient remaining places and duplicate subjects cannot trigger an automatic batch", () => {
  const { previous, current, command } = fixture();
  previous.allocations[0].quantity = current.allocations[0].quantity = 2;
  assert.equal(rebaseLeaderBatch(command, previous, current, "new"), null);
  previous.allocations[0].quantity = current.allocations[0].quantity = 5;
  command.subjects.push(command.subjects[0]);
  assert.equal(rebaseLeaderBatch(command, previous, current, "new"), null);
});
