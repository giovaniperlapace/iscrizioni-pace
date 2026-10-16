import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isReceptionOperator } from "../lib/reception/access.server.ts";
import { executeReceptionCommand } from "../lib/reception/check-in.server.ts";
import { executeBadgeCommand } from "../lib/reception/group-badges.server.ts";
import { executeLabelCommand } from "../lib/reception/qr-labels.server.ts";
import { getDashboardRoleTabs } from "../lib/auth/dashboard-tabs.ts";
import { pickDashboardRole, type EventRole } from "../lib/auth/roles.ts";

const id = "11111111-1111-4111-8111-111111111111";
type Role = { role: EventRole; event_id: string | null };
const reception: Role = { role: "accoglienza", event_id: "event" };
const manager: Role = { role: "manager", event_id: "event" };
function session(roles: Role[], failure = "") {
  return {
    auth: { getUser: async () => ({ data: { user: failure === "anonymous" ? null : { id } }, error: failure === "auth" ? {} : null }) },
    from(table: string) {
      const data = () => ({ data: table === "events" ? failure === "no-event" ? null : { id: "event" } : roles, error: failure === table ? {} : null });
      return { select() { return this; }, eq(key: string, value: unknown) {
        if (table === "event_user_roles") { assert.equal(key, "user_id"); assert.equal(value, id); }
        return this;
      }, maybeSingle: async () => data(), then(resolve: (value: unknown) => unknown) { return Promise.resolve(data()).then(resolve); } };
    },
  } as unknown as SupabaseClient;
}

test("reception access is cumulative, scoped and reread after future grants/revocations", async () => {
  const roles: Role[] = [manager];
  const db = session(roles);
  assert.equal(await isReceptionOperator(db), false);
  roles.push(reception);
  assert.equal(await isReceptionOperator(db), true);
  assert.equal(pickDashboardRole(roles.map(r => r.role), "accoglienza"), "accoglienza");
  assert.deepEqual(getDashboardRoleTabs(roles.map(r => ({role:r.role,eventId:r.event_id}))).map(t => t.key), ["manager", "accoglienza", "partecipante"]);
  roles.pop();
  assert.equal(await isReceptionOperator(db), false);
  for (const failure of ["anonymous", "auth", "events", "no-event", "event_user_roles"]) assert.equal(await isReceptionOperator(session([reception], failure)), false);
});

test("scanner, full badges and QR labels enforce the same operator matrix before service access", async () => {
  const matrix: [Role[], boolean][] = [
    [[reception], true], [[manager, reception], true], [[{role:"admin",event_id:null}], true],
    [[manager], false], [[], false], [[{...reception,event_id:"old-event"}], false],
    [[manager,{...reception,event_id:"old-event"}], false], [[{...reception,event_id:null}], false],
    [[{role:"admin",event_id:"event"}], false], [[{role:"manager_viewer",event_id:"event"}], false],
    [[{role:"capogruppo",event_id:"event"}], false],
  ];
  for (const [roles, allowed] of matrix) {
    let calls = 0;
    const service = () => { calls++; return {rpc:async()=>({data:{status:"invalid"},error:null})} as unknown as SupabaseClient; };
    const db = session(roles);
    assert.equal(await isReceptionOperator(db), allowed);
    const results = await Promise.all([
      executeReceptionCommand(db, service, {duty:"event_entry",action:"inspect",lookup:{kind:"code",value:"TEST"}}, "event"),
      executeBadgeCommand(db, service, {action:"read",token:"G:"+"a".repeat(43)}),
      executeLabelCommand(db, service, {action:"read",registrationId:id}),
    ]);
    assert.equal(calls, allowed ? 3 : 0);
    for (const result of results) assert.equal(result.status === "forbidden", !allowed);
  }
});
