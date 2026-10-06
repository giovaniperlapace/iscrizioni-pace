import test from "node:test";
import assert from "node:assert/strict";
import {
  parseSeatMapCommand,
  validMapSeats,
  contiguousSeats,
} from "../lib/ceremonies/seat-map.ts";
import {
  executeSeatMap,
  loadSeatMap,
} from "../lib/ceremonies/seat-map.server.ts";
import { SEAT_MAP_COPY } from "../lib/ceremonies/seat-map-copy.ts";
import { parseCeremonySeatInfo } from "../lib/ceremonies/seat-projection.ts";
const id = (i: number) =>
  `11111111-1111-4111-8111-${String(i).padStart(12, "0")}`;
const seat = (i: number) => ({
  id: id(i),
  sectorId: id(30),
  row: "A",
  number: String(i),
  x: i * 60,
  y: 0,
  blocked: false,
});
const command = {
  planId: id(100),
  revision: 2,
  requestId: id(200),
  operation: "reserve",
  data: { allocationId: id(300), seatIds: [id(1)] },
};
test("map commands reject actor spoofing, duplicate selection and uncertain intent", () => {
  assert.ok(parseSeatMapCommand(command));
  for (const patch of [
    { actor: id(999) },
    { revision: NaN },
    { requestId: "" },
    { operation: "replace" },
    { data: { ...command.data, seatIds: [id(1), id(1)] } },
    { operation: "name" },
    { operation: "unname", data: { ...command.data, nomineeId: id(4) } },
  ])
    assert.equal(parseSeatMapCommand({ ...command, ...patch }), null);
  assert.ok(
    parseSeatMapCommand({
      ...command,
      operation: "name",
      data: { ...command.data, nomineeId: id(4) },
    }),
  );
});
test("layout validation preserves identities and rejects duplicate labels or invalid geometry", () => {
  assert.ok(validMapSeats([seat(1), seat(2)]));
  for (const seats of [
    [seat(1), seat(1)],
    [seat(1), { ...seat(2), number: " 1 " }],
    [{ ...seat(1), x: Infinity }],
    [{ ...seat(1), blocked: "false" }],
    [{ ...seat(1), row: "" }],
    [{ ...seat(1), sectorId: "foreign" }],
  ])
    assert.equal(validMapSeats(seats), false);
  assert.ok(validMapSeats([{ ...seat(1), x: 4000, y: 3000 }]));
});
test("contiguous suggestions cannot cross blocked seats, occupied seats, sectors or numbering gaps", () => {
  const seats = [
    seat(1),
    seat(2),
    { ...seat(3), blocked: true },
    seat(4),
    seat(5),
  ];
  assert.deepEqual(contiguousSeats(seats, new Set(seats.map((s) => s.id)), 2), [
    id(1),
    id(2),
  ]);
  assert.deepEqual(contiguousSeats(seats, new Set([id(2), id(4), id(5)]), 2), [
    id(4),
    id(5),
  ]);
  assert.deepEqual(
    contiguousSeats(seats, new Set(seats.map((s) => s.id)), 3),
    [],
  );
  assert.deepEqual(
    contiguousSeats(
      [seat(1), { ...seat(2), sectorId: id(31) }],
      new Set([id(1), id(2)]),
      2,
    ),
    [],
  );
  assert.deepEqual(
    contiguousSeats(
      [{ ...seat(1), number: "A" }, seat(2)],
      new Set([id(1), id(2)]),
      2,
    ),
    [],
  );
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
                  ? [{ group_id: id(1) }]
                  : []
                : [{ role, event_id: role === "admin" ? null : "event" }],
            error: null,
          }),
      };
      return chain;
    },
  };
}
test("map service verifies session role before service client and limits leaders to received seats", async () => {
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
    (await executeSeatMap(db() as never, service, "manager", command)).status,
    "saved",
  );
  assert.equal(
    (
      await executeSeatMap(
        db("manager_viewer") as never,
        service,
        "manager",
        command,
      )
    ).status,
    "forbidden",
  );
  assert.equal(
    (await executeSeatMap(db() as never, service, "leader", command)).status,
    "forbidden",
  );
  const named = {
    ...command,
    operation: "name",
    data: { ...command.data, nomineeId: id(44) },
  };
  assert.equal(
    (await executeSeatMap(db() as never, service, "leader", named)).status,
    "saved",
  );
  assert.equal(
    (
      await executeSeatMap(
        db("manager", false) as never,
        service,
        "leader",
        named,
      )
    ).status,
    "forbidden",
  );
  const draft = {
    ...command,
    operation: "draft",
    data: { title: "Synthetic", seats: [seat(1)] },
  };
  assert.equal(
    (await executeSeatMap(db() as never, service, "manager", draft)).status,
    "forbidden",
  );
  assert.equal(
    (await executeSeatMap(db("admin") as never, service, "manager", draft))
      .status,
    "saved",
  );
  assert.equal(calls, 3);
});
test("map snapshot failures are blocking, not empty availability", async () => {
  for (const result of [
    { data: null, error: { code: "42P01" } },
    {
      data: { revision: 3, sectors: [], allocations: [], claims: [] },
      error: null,
    },
  ])
    await assert.rejects(
      loadSeatMap(
        db() as never,
        () => ({ rpc: async () => result }) as never,
        "manager",
        id(1),
      ),
      /unavailable/,
    );
});
test("numbered seats have complete seven-language operational copy", () => {
  assert.equal(Object.keys(SEAT_MAP_COPY).length, 7);
  for (const c of Object.values(SEAT_MAP_COPY)) {
    assert.deepEqual(
      Object.keys(c).sort(),
      Object.keys(SEAT_MAP_COPY.it).sort(),
    );
    for (const s of Object.values(c)) assert.ok(s.trim());
  }
});
test("badge and reception projection carries only seat facts, not private DB fields", () => {
  const value = {
    kind: "opening",
    sector: "North",
    needsSeat: true,
    review: false,
    seat: {
      id: id(1),
      row: "A",
      number: "1",
      mapVersion: 1,
      private: "hidden",
    },
    email: "hidden",
  };
  assert.deepEqual(parseCeremonySeatInfo([value]), [
    {
      kind: "opening",
      sector: "North",
      needsSeat: true,
      review: false,
      seat: { id: id(1), row: "A", number: "1", mapVersion: 1 },
    },
  ]);
  assert.equal(
    parseCeremonySeatInfo([{ ...value, seat: { number: "1" } }]),
    null,
  );
  assert.equal(parseCeremonySeatInfo(null), null);
});
