import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { loadAllRows, loadRowsForIds } from "../lib/supabase/all-rows.ts";

function fixture(roles = [{ role: "manager", eventId: "event" }], count = 1, fail = false) {
  const calls: { table: string; ids: string[]; filters: unknown[][] }[] = [];
  const db = { from(table: string) {
    const call = { table, ids: [] as string[], filters: [] as unknown[][] }; calls.push(call);
    const query = {
      select() { return query; }, order() { return query; },
      eq(...args: unknown[]) { call.filters.push(args); return query; },
      is(...args: unknown[]) { call.filters.push(args); return query; },
      in(_field: string, ids: string[]) { call.ids = ids; return query; },
      range(from: number, to: number) {
        if (fail) return Promise.resolve({ data: null, error: { message: "unavailable" } });
        const data = table === "audit_logs" ? Array.from({ length: count }, (_, i) => ({ entity_id: `a${i}` })) : call.ids.map(id => ({ id, registration_id: id, groups: { name: "Group" }, registrations: { participants: { first_name: "Anna", last_name: "Bianchi" } } }));
        return Promise.resolve({ data: data.slice(from, to + 1), error: null });
      },
    }; return query;
  } };
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const modules: Record<string, unknown> = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "@/lib/auth/session": { getCurrentAuthContext: async () => ({ eventRoles: roles }) },
    "@/lib/supabase/server": { createSupabaseServerClient: async () => ({}) },
    "@/lib/supabase/service": { createSupabaseServiceClient: () => db },
    "@/lib/supabase/all-rows": { loadAllRows, loadRowsForIds },
    "@/components/pending-link": { default: "a" },
  };
  const code = ts.transpileModule(readFileSync("app/dashboard/group-assignment-reports.tsx", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports: { GroupAssignmentReports?: (p: unknown) => Promise<unknown> } = {};
  new Function("require", "exports", code)((name: string) => { assert.ok(name in modules, name); return modules[name]; }, exports);
  return { calls, render: () => exports.GroupAssignmentReports!({ dashboard: "manager", eventId: "event" }) };
}

test("reports require a manager of the event or global admin before any data read", async () => {
  for (const roles of [[], [{ role: "capogruppo", eventId: "event" }], [{ role: "manager_viewer", eventId: "event" }], [{ role: "manager", eventId: "other" }]]) {
    const f = fixture(roles); assert.equal(await f.render(), null); assert.equal(f.calls.length, 0);
  }
  const admin = fixture([{ role: "admin", eventId: null as unknown as string }]);
  assert.ok(await admin.render());
});
test("reports page all notifications and batch assignments, scoped to active records in the event", async () => {
  const f = fixture(undefined, 1201); const result = JSON.stringify(await f.render());
  assert.match(result, /a1200/);
  assert.equal(f.calls.filter(c => c.table === "audit_logs").length, 3);
  for (const c of f.calls.filter(c => c.table !== "audit_logs")) {
    assert.ok(c.ids.length <= 100);
    assert.ok(c.filters.some(v => v[0] === "is_current" && v[1] === true));
    assert.ok(c.filters.some(v => v[0] === "registrations.event_id" && v[1] === "event"));
    assert.ok(c.filters.some(v => v[0] === "registrations.deleted_at" && v[1] === null));
  }
});
test("read failures show an alert instead of hiding pending reports", async () => {
  const f = fixture(undefined, 1, true);
  assert.match(JSON.stringify(await f.render()), /Impossibile caricare/);
});
