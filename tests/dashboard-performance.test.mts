import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server.js";
import { dashboardLoadPlan } from "../lib/registrations/dashboard-load-plan.ts";
import { loadAllRows, loadRowsForIds } from "../lib/supabase/all-rows.ts";
import * as operations from "../lib/registrations/operations-dashboard.ts";
import * as statistics from "../lib/registrations/event-statistics.ts";

function compile(path: string, modules: Record<string, unknown>, components = false) {
  const code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports: Record<string, (...args: never[]) => Promise<unknown>> = {};
  new Function("require", "exports", code)((name: string) => {
    if (name in modules) return modules[name];
    assert.ok(components, name);
    return new Proxy({}, { get: (_, key) => {
      if (key === "__esModule") return true;
      return () => { throw new Error(`Unexpected call: ${name}.${String(key)}`); };
    } });
  }, exports);
  return exports;
}

test("dashboard sections execute only the queries needed by their visible content", async () => {
  for (const dashboard of ["admin", "manager"]) {
    for (const section of ["dashboard", "iscritti", "gruppi", "ruoli", ...(dashboard === "manager" ? ["impostazioni", "email"] : [])]) {
      const reads: string[] = [];
      const db = { from(table: string) {
        const query = new Proxy({}, { get: (_, key) => key === "then"
          ? (resolve: (value: unknown) => unknown) => { reads.push(table); return Promise.resolve({ data: [], error: null }).then(resolve); }
          : () => query });
        return query;
      } };
      const jsx = (type: unknown, props: unknown) => ({ type, props });
      const modules = {
        "react/jsx-runtime": { jsx, jsxs: jsx },
        "node:crypto": { randomUUID: () => "version" },
        "@/lib/registrations/dashboard-load-plan": { dashboardLoadPlan },
        "@/lib/supabase/all-rows": { loadAllRows, loadRowsForIds },
        "@/lib/registrations/operations-dashboard": operations,
        "@/lib/registrations/event-statistics": statistics,
        "@/lib/registrations/event-statistics.server": { loadEventStatisticsSnapshot: async () => { reads.push("statistics"); return {}; } },
        "@/lib/auth/session": { getCurrentAuthContext: async () => ({ user: { id: "operator" }, eventRoles: [{ role: "admin", eventId: null }] }) },
        "@/lib/supabase/server": { createSupabaseServerClient: async () => db },
        "@/lib/supabase/service": { createSupabaseServiceClient: () => db },
        "@/lib/events/current": { getCurrentOperationalEvent: async () => ({ id: "event", title: "Fixture" }) },
        "@/lib/operational-users/identity": { getOperationalUserIdentities: async () => new Map() },
      };
      const page = compile(`app/dashboard/${dashboard}/page.tsx`, modules, true).default;
      await page({ searchParams: Promise.resolve({ section }) } as never);
      const context = `${dashboard}/${section}`;
      assert.equal(reads.includes("registrations"), section === "iscritti" || section === "gruppi", context);
      assert.equal(reads.includes("group_registration_links"), section === "gruppi", context);
      assert.equal(reads.includes("event_user_roles"), section === "gruppi" || section === "ruoli", context);
      assert.equal(reads.includes("statistics"), section === "dashboard", context);
      assert.equal(reads.includes("event_services"), ["iscritti", "gruppi", "impostazioni"].includes(section), context);
    }
  }
});

test("lazy attendance authenticates, checks event scope and never caches private responses", async () => {
  const id = "00000000-0000-4000-8000-000000000001";
  for (const scenario of ["anonymous", "participant", "leader", "viewer", "foreign", "manager", "admin", "invalid", "missing", "error"]) {
    let reads = 0;
    const roles = scenario === "admin" ? [{ role: "admin", eventId: null }] : [{
      role: ({ participant: "partecipante", leader: "capogruppo", viewer: "manager_viewer" } as Record<string,string>)[scenario] ?? "manager",
      eventId: scenario === "foreign" ? "other" : "event",
    }];
    const route = compile("app/dashboard/participants/attendance/route.ts", {
      "next/server": { NextResponse },
      "@/lib/auth/session": { getCurrentAuthContext: async () => scenario === "anonymous" ? null : { eventRoles: roles } },
      "@/lib/supabase/server": { createSupabaseServerClient: async () => ({}) },
      "@/lib/supabase/service": { createSupabaseServiceClient: () => ({}) },
      "@/lib/registrations/operations-attendance.server": { loadOperationsAttendance: async (_db: unknown, registrationId: string, allowed: (id: string) => boolean) => {
        reads++;
        assert.equal(registrationId, id);
        if (scenario === "error") throw new Error("database unavailable");
        return scenario === "missing" || !allowed("event") ? null : { unknown: true, slots: [] };
      } },
    });
    const response = await route.GET(new NextRequest(`http://localhost/dashboard/participants/attendance?registrationId=${scenario === "invalid" ? "invalid" : id}`) as never) as Response;
    const expected = ({ anonymous: 401, participant: 403, leader: 403, viewer: 403, foreign: 404, manager: 200, admin: 200, invalid: 400, missing: 404, error: 500 } as Record<string, number>)[scenario];
    assert.equal(response.status, expected, scenario);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.equal(reads, [401,403,400].includes(expected) ? 0 : 1);
    if (expected !== 200) assert.deepEqual(await response.json(), {});
  }
});
