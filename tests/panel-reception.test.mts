import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseReceptionCommand, type ReceptionCommand, type ReceptionResult } from "../lib/reception/contracts.ts";
import { executeReceptionCommand, projectReceptionResult } from "../lib/reception/check-in.server.ts";
import { ReceptionStationSession } from "../lib/reception/station.ts";
import { getDashboardRoleTabs } from "../lib/auth/dashboard-tabs.ts";
import { isRoleAllowedForDashboard } from "../lib/auth/roles.ts";

const panelId = "11111111-1111-4111-8111-111111111111";
const adultId = "22222222-2222-4222-8222-222222222222";
const requestId = "33333333-3333-4333-8333-333333333333";
const inspect: ReceptionCommand = { duty: "panel_entry", panelId, action: "inspect", lookup: { kind: "code", value: "TEST" } };
const family = (arrived = true): Extract<ReceptionResult, { kind: "family" }> => ({
  status: "valid", kind: "family", revision: 0, outcome: "verified", registrationStatus: "confirmed", code: "TEST",
  panel: { id: panelId, title: "Panel sintetico", room: "Sala test", section: "Individuali" },
  persons: [{ id: adultId, kind: "adult", firstName: "Anna", lastName: "Test", checkedInAt: null, eventCheckedIn: arrived }],
});

test("panel context is explicit; room assistance cannot submit mutations", () => {
  assert.deepEqual(parseReceptionCommand(inspect), inspect);
  assert.equal(parseReceptionCommand({ ...inspect, panelId: undefined }), null);
  assert.equal(parseReceptionCommand({ ...inspect, duty: "event_entry" }), null);
  assert.equal(parseReceptionCommand({ ...inspect, actorUserId: adultId }), null);
  for (const action of ["enter", "correct", "cancel"]) {
    assert.equal(parseReceptionCommand({ ...inspect, duty: "room_assistance", action, requestId, expectedRevision: 0, reason: "selection_error" }), null);
  }
});

test("panel navigation grants neither manager access nor an event role", () => {
  assert.equal(isRoleAllowedForDashboard("accoglienza", new Set(["partecipante"]), true), true);
  assert.equal(isRoleAllowedForDashboard("manager", new Set(["partecipante"]), true), false);
  assert.deepEqual(getDashboardRoleTabs([], "it", true).map(tab => tab.key), ["accoglienza", "partecipante"]);
});

function backend(assigned: boolean, result: ReceptionResult = family()) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const filters: [string, string, unknown][] = [];
  const session = {
    auth: { getUser: async () => ({ data: { user: { id: "actor" } }, error: null }) },
    from(table: string) {
      const value = () => ({ data: table === "events" ? { id: "current-event" } : table === "panel_reception_assignments" ? assigned ? { id: "assignment" } : null : [], error: null });
      return { select() { return this; }, eq(key: string, value: unknown) { filters.push([table, key, value]); return this; },
        maybeSingle: async () => value(), then(resolve: (value: unknown) => unknown) { return Promise.resolve(value()).then(resolve); } };
    },
  } as unknown as SupabaseClient;
  const service = () => ({ rpc: async (name: string, args: Record<string, unknown>) => { calls.push({ name, args }); return { data: result, error: null }; } }) as unknown as SupabaseClient;
  return { session, service, calls, filters };
}

test("panel command rereads exact assignment, derives actor/event, and uses its separate RPC", async () => {
  const f = backend(true);
  assert.equal((await executeReceptionCommand(f.session, f.service, inspect, "current-event")).status, "valid");
  assert.equal(f.calls[0].name, "reception_panel_check_in");
  assert.equal(f.calls[0].args.p_actor_user_id, "actor");
  assert.equal(f.calls[0].args.p_event_id, "current-event");
  assert.equal(f.calls[0].args.p_panel_id, panelId);
  for (const [key, value] of [["user_id", "actor"], ["panel_id", panelId], ["duty", "panel_entry"], ["event_id", "current-event"]]) {
    assert.ok(f.filters.some(([table, field, actual]) => table === "panel_reception_assignments" && field === key && actual === value));
  }
});

test("absent/revoked assignment and event-entry escalation never reach the privileged RPC", async () => {
  for (const command of [inspect, { duty: "event_entry" as const, action: "inspect" as const, lookup: inspect.lookup }]) {
    const f = backend(false);
    assert.equal((await executeReceptionCommand(f.session, f.service, command)).status, "forbidden");
    assert.equal(f.calls.length, 0);
  }
  const f = backend(true);
  assert.equal((await executeReceptionCommand(f.session, f.service, inspect, "old-event")).status, "forbidden");
  assert.equal(f.calls.length, 0);
});

test("panel response must match the selected context and include event eligibility", async () => {
  const result = family();
  const wrongPanel = backend(true, { ...result, panel: { ...result.panel!, id: adultId } });
  assert.equal((await executeReceptionCommand(wrongPanel.session, wrongPanel.service, inspect)).status, "unavailable");
  const missingEligibility = backend(true, { ...result, persons: result.persons.map(person => ({ ...person, eventCheckedIn: undefined })) });
  assert.equal((await executeReceptionCommand(missingEligibility.session, missingEligibility.service, inspect)).status, "unavailable");
});

test("room scans remain read-only even through correction/retry controls", async () => {
  const calls: ReceptionCommand[] = [];
  const session = new ReceptionStationSession(async command => { calls.push(command); return { status: "valid", kind: "room", label: "Anna Test", panel: family().panel!, revision: 0, outcome: "verified", registrationStatus: "confirmed" }; }, () => requestId, 20000, { duty: "room_assistance", panelId });
  await session.inspect(inspect.lookup);
  await session.editCurrent();
  session.setMode("correct");
  await session.submit({ subjectIds: [adultId] }, true);
  assert.deepEqual(calls.map(command => command.action), ["inspect"]);
  assert.equal(session.snapshot().phase, "result");
});

test("panel entry never automatically records an event arrival for a missing adult", async () => {
  const calls: ReceptionCommand[] = [];
  const session = new ReceptionStationSession(async command => { calls.push(command); return family(false); }, () => requestId, 20000, { duty: "panel_entry", panelId });
  await session.inspect(inspect.lookup);
  assert.equal(calls.length, 1);
  assert.equal(session.snapshot().problem, "event_entry_required");
});

test("uncertain panel entry retries the original panel, subject and request UUID", async () => {
  const calls: ReceptionCommand[] = [];
  let writes = 0;
  const session = new ReceptionStationSession(async command => {
    calls.push(command);
    return command.action === "inspect" ? family() : ++writes === 1 ? { status: "unavailable" } : { ...family(), outcome: "replayed" };
  }, () => requestId, 20000, { duty: "panel_entry", panelId });
  await session.inspect(inspect.lookup);
  assert.equal(session.snapshot().phase, "uncertain");
  await session.inspect({ kind: "code", value: "NEXT" });
  assert.equal(calls.length, 2);
  await session.retry();
  assert.equal(calls[1], calls[2]);
  assert.equal(calls[2].panelId, panelId);
  assert.equal(calls[2].requestId, requestId);
  assert.ok(calls.every(command => command.duty === "panel_entry"));
});


test("room projection strips subject IDs, contacts, quantities and attendance history", () => {
  const room = { status: "valid", kind: "room", label: "Anna Test", panel: family().panel!, revision: 0, outcome: "verified", registrationStatus: "confirmed" };
  assert.deepEqual(projectReceptionResult({ ...room, persons: family().persons, registrationId: adultId, students: 10, email: "private@example.invalid", checkedInAt: "2026-10-06T12:00:00Z" }), room);
});
