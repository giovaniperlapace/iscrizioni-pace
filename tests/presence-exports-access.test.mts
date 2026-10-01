import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { isPresenceVariant } from "../lib/presence-exports/catalog.ts";
import { sanitizeLastDashboardPath } from "../lib/auth/session-persistence.ts";

const path = new URL("../app/dashboard/manager/esportazioni/route.ts", import.meta.url);
const js = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
function fixture(roles: { role: string; eventId: string | null }[] | null, fail = false) {
  const reads: string[] = [];
  const deps = {
    "@/lib/auth/session": { getCurrentAuthContext: async () => roles ? { eventRoles: roles } : null },
    "@/lib/supabase/server": { createSupabaseServerClient: async () => ({}) },
    "@/lib/supabase/service": { createSupabaseServiceClient: () => { reads.push("service-client"); return {}; } },
    "@/lib/events/current": { getCurrentOperationalEvent: async () => ({ id: "current", title: "Fixture", starts_on: "2026-10-25", ends_on: "2026-10-27" }) },
    "@/lib/presence-exports/catalog": { isPresenceVariant },
    "@/lib/presence-exports/config": { presenceConfigForEvent: () => ({ eventId: "current" }) },
    "@/lib/presence-exports/data.server": { loadPresenceSource: async (_db: unknown, event: { id: string }, services: boolean) => {
      assert.equal(event.id, "current"); reads.push(services ? "services" : "groups"); if (fail) throw new Error("private database detail"); return {};
    } },
    "@/lib/presence-exports/report": { buildPresenceReport: () => ({}) },
    "@/lib/presence-exports/workbook": { writePresenceWorkbook: async () => new Uint8Array([80, 75]) },
  };
  const exports: { GET?: (request: Request) => Promise<Response> } = {};
  new Function("require", "exports", js)((name: string) => { assert.ok(name in deps, name); return deps[name as keyof typeof deps]; }, exports);
  return { get: (query = "report=a") => exports.GET!(new Request(`http://localhost/dashboard/manager/esportazioni?${query}`)), reads };
}
test("only global admins and current-event managers/viewers reach protected data", async () => {
  for (const roles of [null, [], [{ role: "capogruppo", eventId: "current" }], [{ role: "manager", eventId: "other" }], [{ role: "manager_viewer", eventId: "other" }], [{ role: "admin", eventId: "current" }]]) {
    const f = fixture(roles); const response = await f.get();
    assert.equal(response.status, roles === null ? 401 : 403); assert.deepEqual(f.reads, []);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  }
  for (const roles of [[{ role: "manager", eventId: "current" }], [{ role: "manager_viewer", eventId: "current" }], [{ role: "admin", eventId: null }]]) for (const variant of ["a", "a2", "b", "b2"]) {
    const f = fixture(roles); const response = await f.get(`report=${variant}&event=current`);
    assert.equal(response.status, 200); assert.match(response.headers.get("Content-Type")!, /spreadsheetml/);
    assert.match(response.headers.get("Content-Disposition")!, new RegExp(`presenze_${variant}.xlsx`));
    assert.deepEqual(f.reads, ["service-client", variant.startsWith("b") ? "services" : "groups"]);
  }
});
test("invalid reports and stale event URLs cannot query participant data; failures never return a partial workbook", async () => {
  const roles = [{ role: "manager", eventId: "current" }];
  for (const [query, status] of [["report=invalid", 400], ["report=a&event=other", 409]] as const) {
    const f = fixture(roles); assert.equal((await f.get(query)).status, status); assert.deepEqual(f.reads, []);
  }
  const result = await fixture(roles, true).get();
  assert.equal(result.status, 500); assert.doesNotMatch(await result.text(), /private database detail/);
});
test("exports navigation survives returning to both dashboards", () => {
  for (const role of ["admin", "manager"]) assert.equal(sanitizeLastDashboardPath(`/dashboard/${role}?section=esportazioni&nav=mini`), `/dashboard/${role}?section=esportazioni&nav=mini`);
});
