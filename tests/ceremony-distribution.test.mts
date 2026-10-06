import test from "node:test";
import assert from "node:assert/strict";
import {
  parseNomineeCommand,
  eligibleSubjects,
  type DistributionView,
} from "../lib/ceremonies/distribution.ts";
import { DISTRIBUTION_COPY } from "../lib/ceremonies/distribution-copy.ts";
import {
  executeNominee,
  loadDistribution,
} from "../lib/ceremonies/distribution.server.ts";
const id = "11111111-1111-4111-8111-111111111111";
const command = {
  action: "assign",
  allocationId: id,
  registrationId: id,
  childId: null,
  nomineeId: null,
  revision: 2,
  requestId: id,
};
test("nomination commands reject actor spoofing, malformed identity and implicit child decisions", () => {
  assert.ok(parseNomineeCommand(command));
  assert.ok(
    parseNomineeCommand({ ...command, action: "no_seat", childId: id }),
  );
  for (const patch of [
    { actor: id },
    { revision: -1 },
    { revision: 1.5 },
    { requestId: "" },
    { childId: undefined },
    { action: "no_seat" },
    { action: "move" },
    { action: "revoke" },
    { nomineeId: id },
  ])
    assert.equal(parseNomineeCommand({ ...command, ...patch }), null);
  assert.ok(
    parseNomineeCommand({
      ...command,
      action: "revoke",
      nomineeId: id,
      allocationId: null,
      registrationId: null,
    }),
  );
});
test("each child stays independent of parent decisions; exact group controls eligibility", () => {
  const a = {
    id: "allocation",
    planId: "plan",
    groupId: "group",
  } as DistributionView["allocations"][number];
  const view = {
    allocations: [a],
    nominees: [],
    people: [
      {
        registrationId: id,
        name: "Adult",
        code: "TEST",
        groupIds: ["group"],
        children: [
          { id: "child1", name: "Child 1" },
          { id: "child2", name: "Child 2" },
        ],
        eligiblePlanIds: ["plan"],
        assigned: [
          { planId: "plan", childId: null, needsSeat: true },
          { planId: "plan", childId: "child1", needsSeat: false },
        ],
      },
    ],
  } as DistributionView;
  const rows = eligibleSubjects(view, a);
  assert.deepEqual(
    rows.map((r) => r.assigned),
    [true, true, false],
  );
  assert.equal(rows[2].eligible, true);
  assert.deepEqual(eligibleSubjects(view, { ...a, groupId: "unrelated" }), []);
});
function db(role = "manager", membership = true) {
  return {
    auth: {
      getUser: async () => ({
        data: { user: { id: "session-actor" } },
        error: null,
      }),
    },
    from(table: string) {
      const chain = {
        select: () => chain,
        eq: () => chain,
        limit: () => chain,
        maybeSingle: async () => ({
          data: { id: "event", title: "Event" },
          error: null,
        }),
        then: (resolve: (v: unknown) => unknown) =>
          resolve({
            data:
              table === "group_memberships"
                ? membership
                  ? [{ group_id: id }]
                  : []
                : [{ role, event_id: "event" }],
            error: null,
          }),
      };
      return chain;
    },
  };
}
test("manager may assign from event view; leader membership is additive; viewer cannot write", async () => {
  let calls = 0;
  const service = () =>
    ({
      rpc: async (_name: string, args: Record<string, unknown>) => {
        calls++;
        assert.equal(args.p_actor, "session-actor");
        assert.equal(args.p_event, "event");
        return { data: { status: "saved" }, error: null };
      },
    }) as never;
  assert.equal(
    (await executeNominee(db() as never, service, "manager", command)).status,
    "saved",
  );
  assert.equal(
    (await executeNominee(db() as never, service, "leader", command)).status,
    "saved",
  );
  assert.equal(
    (
      await executeNominee(
        db("manager_viewer") as never,
        service,
        "manager",
        command,
      )
    ).status,
    "forbidden",
  );
  assert.equal(
    (
      await executeNominee(
        db("manager", false) as never,
        service,
        "leader",
        command,
      )
    ).status,
    "forbidden",
  );
  assert.equal(calls, 2);
});
test("distribution read failures cannot masquerade as empty dotations", async () => {
  for (const result of [
    { data: null, error: { code: "42P01" } },
    { data: { allocations: [], people: [] }, error: null },
  ])
    await assert.rejects(
      loadDistribution(
        db() as never,
        () => ({ rpc: async () => result }) as never,
        "manager",
      ),
      /unavailable/,
    );
});
test("all seven ceremony translations include explicit child seat/no-seat choice", () => {
  assert.equal(Object.keys(DISTRIBUTION_COPY).length, 7);
  for (const copy of Object.values(DISTRIBUTION_COPY)) {
    assert.deepEqual(
      Object.keys(copy).sort(),
      Object.keys(DISTRIBUTION_COPY.it).sort(),
    );
    for (const value of Object.values(copy)) assert.ok(value.trim());
    assert.notEqual(copy.noSeat, copy.assign);
  }
});
