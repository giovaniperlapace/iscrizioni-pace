import test from "node:test";
import assert from "node:assert/strict";
import { parseCeremonyForm } from "../lib/ceremonies/contracts.ts";
import {
  ceremonyContext,
  executeCeremony,
  loadCeremony,
} from "../lib/ceremonies/service.ts";
const id = "11111111-1111-4111-8111-111111111111";
function form(values: Record<string, string | undefined> = {}) {
  const f = new FormData();
  for (const [k, v] of Object.entries({
    kind: "opening",
    revision: "-1",
    operation: "configure",
    location: "Sala A",
    state: "draft",
    attendancePart: "day",
    ...values,
  }))
    if (v !== undefined) f.set(k, v);
  return f;
}
const db = (
  roles: { role: string; event_id: string | null }[],
  error = false,
) => ({
  auth: {
    getUser: async () => ({
      data: { user: { id: "session-user" } },
      error: null,
    }),
  },
  from() {
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => ({
        data: { id: "event", title: "Event" },
        error: null,
      }),
      then: (resolve: (value: unknown) => unknown) =>
        resolve({
          data: roles,
          error: error ? new Error("read failed") : null,
        }),
    };
    return chain;
  },
});
test("ceremonies preserve unknown capacity versus zero and validate configuration", () => {
  assert.equal(parseCeremonyForm(form())?.data.capacity, "");
  assert.equal(parseCeremonyForm(form({ capacity: "0" }))?.data.capacity, "0");
  for (const values of [
    { capacity: "-1" },
    { capacity: "1.2" },
    { capacity: "1000001" },
    { kind: "panel" },
    { revision: "NaN" },
    { state: "published" },
    { startsAt: "2026-10-25T12:00" },
    { startsAt: "2026-10-25T12:00", endsAt: "2026-10-25T11:00" },
  ])
    assert.equal(parseCeremonyForm(form(values)), null);
});
test("ceremony assignment requires exactly one recipient, one seat per named person", () => {
  const base = {
    operation: "allocate",
    revision: "2",
    id,
    quotaId: id,
    quantity: "1",
    registrationId: id,
  };
  assert.ok(parseCeremonyForm(form(base)));
  for (const values of [
    { quantity: "2" },
    { groupId: id },
    { registrationId: "" },
    { registrationId: "malformed" },
    { id: "" },
  ])
    assert.equal(parseCeremonyForm(form({ ...base, ...values })), null);
  assert.ok(
    parseCeremonyForm(
      form({ ...base, registrationId: "", groupId: id, quantity: "250" }),
    ),
  );
});
test("ceremony scope grants viewer only read and fails closed on role read errors", async () => {
  const viewer = await ceremonyContext(
    db([{ role: "manager_viewer", event_id: "event" }]) as never,
  );
  assert.equal(viewer?.canManage, false);
  assert.equal(
    await ceremonyContext(
      db([{ role: "manager", event_id: "foreign" }]) as never,
    ),
    null,
  );
  assert.equal(
    await ceremonyContext(
      db([{ role: "admin", event_id: null }], true) as never,
    ),
    null,
  );
  assert.equal(
    await ceremonyContext(
      db([{ role: "accoglienza", event_id: "event" }]) as never,
    ),
    null,
  );
});
test("forbidden actions never instantiate service client; actor and event come from session", async () => {
  const forbidden = () => {
    throw Error("Service created without authorization");
  };
  assert.equal(
    (
      await executeCeremony(
        db([{ role: "manager", event_id: "event" }]) as never,
        forbidden,
        form(),
      )
    ).status,
    "forbidden",
  );
  assert.equal(
    (
      await executeCeremony(
        db([{ role: "manager_viewer", event_id: "event" }]) as never,
        forbidden,
        form({ operation: "revoke", id }),
      )
    ).status,
    "forbidden",
  );
  let call: Record<string, unknown> = {};
  const result = await executeCeremony(
    db([{ role: "admin", event_id: null }]) as never,
    () =>
      ({
        rpc: async (_name: string, p: Record<string, unknown>) => {
          call = p;
          return { data: { status: "saved" }, error: null };
        },
      }) as never,
    form({ actor: "forged", eventId: "foreign" }),
  );
  assert.equal(result.status, "saved");
  assert.equal(call.p_actor, "session-user");
  assert.equal(call.p_event, "event");
});
test("a failed ceremony snapshot cannot appear as an empty configuration", async () => {
  await assert.rejects(
    loadCeremony(
      { rpc: async () => ({ data: null, error: { code: "42P01" } }) } as never,
      { event: { id: "event" }, userId: "actor" } as never,
      "opening",
    ),
    /configurazione completa/,
  );
});
