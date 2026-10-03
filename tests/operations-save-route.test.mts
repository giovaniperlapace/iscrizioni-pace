import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server.js";
import * as forms from "../lib/forms/result.ts";
import { operationsReturnPath } from "../lib/registrations/operations-table.ts";
const source = readFileSync(new URL("../app/dashboard/participants/update/route.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function fixture(role: string | null, databaseDenied = false) {
  const calls: unknown[] = [];
  const invalidated: string[] = [];
  const deps: Record<string, unknown> = {
    "next/server": { NextResponse }, "next/cache": { revalidatePath: (path: string) => invalidated.push(path) },
    "@/lib/forms/result": forms, "@/lib/registrations/operations-table": { operationsReturnPath },
    "@/lib/auth/session": { getCurrentAuthContext: async () => role ? { user: { id: "actor" }, eventRoles: [{ role, eventId: role === "admin" ? null : "event" }] } : null },
    "@/lib/supabase/server": { createSupabaseServerClient: async () => ({}) },
    "@/lib/supabase/service": { createSupabaseServiceClient: () => ({ rpc: async (...args: unknown[]) => {
      calls.push(args); return { error: databaseDenied ? { code: "42501" } : null };
    } }) },
  };
  const exports: { POST?: (req: NextRequest) => Promise<Response> } = {};
  new Function("require", "exports", js)((name: string) => {
    assert.ok(name in deps, name); return deps[name];
  }, exports);
  return { save: exports.POST!, calls, invalidated };
}
function request(dashboard = "manager", origin = "https://example.test", invalid = false) {
  const body = new FormData();
  for (const [key, value] of Object.entries({ registrationId: "registration", participantId: "participant", sourceDashboard: dashboard, firstName: invalid ? "" : "Updated", lastName: "Person", phone: "+393331234567" })) body.set(key, value);
  return new NextRequest("https://example.test/dashboard/participants/update", { method: "POST", body, headers: { origin, accept: "application/json" } });
}
for (const role of ["admin", "manager"]) test(`${role} identity and contact save reaches scoped RPC and returns to its dashboard`, async () => {
  const { save, calls, invalidated } = fixture(role);
  const response = await save(request(role));
  assert.equal(response.status, 200);
  assert.match((await response.json()).redirect, new RegExp(`^/dashboard/${role}\\?`));
  assert.deepEqual(calls, [["update_registration_operation", { p_registration_id: "registration", p_participant_id: "participant", p_actor_user_id: "actor", p_field: "identity", p_value: { firstName: "Updated", lastName: "Person", phone: "+393331234567" } }]]);
  assert.equal(invalidated.length, 4);
});
for (const role of [null, "partecipante", "capogruppo", "manager_viewer"]) test(`${role} cannot use the operational save endpoint`, async () => {
  const { save, calls } = fixture(role);
  assert.equal((await save(request())).status, 422);
  assert.deepEqual(calls, []);
});
test("CSRF and invalid fields stop before writes", async () => {
  for (const req of [request("manager", "https://foreign.test"), request("manager", "https://example.test", true)]) {
    const { save, calls } = fixture("manager");
    assert.equal((await save(req)).status, 422);
    assert.deepEqual(calls, []);
  }
});
test("database event-scope denial cannot become success", async () => {
  const { save, invalidated } = fixture("manager", true);
  const response = await save(request());
  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), forms.formFailure([{ field: null, code: "forbidden" }]));
  assert.deepEqual(invalidated, []);
});

test("manager and admin cannot erase birth date through the identity endpoint", async () => {
  for (const role of ["manager", "admin"]) {
    for (const birthDate of ["", "   ", "2026-02-30", "2999-01-01"]) {
      const body = new FormData();
      body.set("birthDate", birthDate); body.set("sourceDashboard", role);
      const req = new NextRequest("https://example.test/dashboard/participants/update", {
        method: "POST", body, headers: { origin: "https://example.test", accept: "application/json" },
      });
      const { save, calls, invalidated } = fixture(role);
      const response = await save(req);
      assert.equal(response.status, 422);
      assert.deepEqual((await response.json()).issues, [{ field: "birthDate", code: "date" }]);
      assert.deepEqual(calls, []); assert.deepEqual(invalidated, []);
    }
  }
});
