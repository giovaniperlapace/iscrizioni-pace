import test from "node:test";
import assert from "node:assert/strict";
import { parsePairTicketCommand } from "../lib/ceremonies/leader-tickets.ts";
import {
  executeLeaderPair,
  loadLeaderTickets,
} from "../lib/ceremonies/leader-tickets.server.ts";
import { LEADER_TICKETS_COPY } from "../lib/ceremonies/leader-tickets-copy.ts";
const id = "11111111-1111-4111-8111-111111111111";
const command = {
  action: "assign",
  allocationId: id,
  revision: 2,
  requestId: id,
  seatId: id,
  registrationId: id,
  childId: null,
  nomineeId: null,
};
test("leader pairing validates exact intent and refuses identity/scope spoofing", () => {
  assert.ok(parsePairTicketCommand(command));
  assert.ok(parsePairTicketCommand({ ...command, seatId: null }));
  assert.ok(
    parsePairTicketCommand({
      ...command,
      action: "no_seat",
      seatId: null,
      childId: id,
    }),
  );
  assert.ok(
    parsePairTicketCommand({
      ...command,
      action: "revoke",
      seatId: null,
      registrationId: null,
      nomineeId: id,
    }),
  );
  for (const patch of [
    { actor: id },
    { eventId: id },
    { groupId: id },
    { quantity: 4 },
    { action: "reserve" },
    { action: "release" },
    { revision: -1 },
    { revision: 1.2 },
    { seatId: undefined },
    { childId: "bad" },
    { nomineeId: id },
    { action: "no_seat" },
    { action: "revoke" },
  ])
    assert.equal(parsePairTicketCommand({ ...command, ...patch }), null);
});
function db(member = true) {
  return {
    auth: {
      getUser: async () => ({
        data: { user: { id: "session-actor" } },
        error: null,
      }),
    },
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        limit: () => chain,
        maybeSingle: async () => ({
          data: { id: "current-event" },
          error: null,
        }),
        then: (resolve: (value: unknown) => unknown) =>
          resolve({
            data:
              table === "group_memberships" && member ? [{ group_id: id }] : [],
            error: null,
          }),
      };
      return chain;
    },
  };
}
test("leader pairing derives actor/event from session, requires membership and preserves uncertain errors", async () => {
  let calls = 0;
  const service = () =>
    ({
      rpc: async (name: string, args: Record<string, unknown>) => {
        calls++;
        assert.equal(name, "pair_ceremony_group_ticket");
        assert.equal(args.p_actor, "session-actor");
        assert.equal(args.p_event, "current-event");
        assert.equal(args.p_seat, id);
        return { data: { status: "saved" }, error: null };
      },
    }) as never;
  assert.equal(
    (await executeLeaderPair(db() as never, service, command)).status,
    "saved",
  );
  assert.equal(
    (await executeLeaderPair(db(false) as never, service, command)).status,
    "forbidden",
  );
  assert.equal(
    (await executeLeaderPair(db() as never, service, { ...command, actor: id }))
      .status,
    "invalid",
  );
  assert.equal(calls, 1);
  for (const [code, status] of [
    ["42501", "forbidden"],
    ["23505", "duplicate"],
    ["22023", "invalid"],
    ["08006", "unavailable"],
  ])
    assert.equal(
      (
        await executeLeaderPair(
          db() as never,
          () =>
            ({ rpc: async () => ({ data: null, error: { code } }) }) as never,
          command,
        )
      ).status,
      status,
    );
});
test("leader ticket read distinguishes failure from empty allocations", async () => {
  for (const data of [null, { allocations: [], people: [], nominees: [] }])
    await assert.rejects(
      loadLeaderTickets(
        db() as never,
        () => ({ rpc: async () => ({ data, error: null }) }) as never,
      ),
      /unavailable/,
    );
  await assert.rejects(
    loadLeaderTickets(db(false) as never, () => {
      throw Error("must not call");
    }),
    /forbidden/,
  );
});
test("pairing copy covers all seven locales", () => {
  assert.equal(Object.keys(LEADER_TICKETS_COPY).length, 7);
  for (const c of Object.values(LEADER_TICKETS_COPY)) {
    assert.deepEqual(Object.keys(c), Object.keys(LEADER_TICKETS_COPY.it));
    for (const value of Object.values(c)) assert.ok(value?.trim());
  }
});
