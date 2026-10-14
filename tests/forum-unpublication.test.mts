import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { formFailureFromRedirect } from "../lib/forms/result.ts";

const source = readFileSync("app/actions.ts", "utf8");
const ast = ts.createSourceFile("actions.ts", source, ts.ScriptTarget.Latest, true);
const node = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "unpublishPanel");
assert.ok(node);
const compiled = ts.transpileModule(node.getText(ast).replace(/^export /, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const eventId = "11111111-1111-4111-8111-111111111100";
const panelId = "11111111-1111-4111-8111-111111111111";
function setup(options: {role?: string; roleEvent?: string; error?: string; loggedOut?: boolean; gateDenied?: boolean} = {}) {
  const calls: unknown[] = [], invalidated: string[] = [];
  const deps = {
    requirePanelManager: async () => { if (options.gateDenied) throw new Error("denied"); },
    optionalText: (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null,
    getPanelDraftsDashboardPath: (dashboard: string, nav: string) => `/dashboard/${dashboard === "admin" ? "admin" : "manager"}?section=panel&panelView=panels&nav=${nav}`,
    createSupabaseServerClient: async () => ({ rpc: async (name: string, args: unknown) => { calls.push({ name, args }); return { error: options.error ? { code: options.error } : null }; } }),
    getCurrentAuthContext: async () => options.loggedOut ? null : ({ eventRoles: [{ role: options.role ?? "manager", eventId: options.roleEvent ?? eventId }] }),
    formFailureFromRedirect, revalidatePath: (path: string) => invalidated.push(path),
    redirect: (path: string) => { throw new Error(path); },
  };
  const action = new Function(...Object.keys(deps), `${compiled};return unpublishPanel;`)(...Object.values(deps));
  const form = new FormData();
  for (const [key, value] of Object.entries({ eventId, panelId, sourceDashboard: "manager", nav: "mini", panelQ: "Pace & dialogo", panelStatus: "published", panelDate: "2026-10-26", panelLocation: "room" })) form.set(key, value);
  return { action, form, calls, invalidated };
}
for (const role of ["admin", "manager"]) test(`withdrawal ${role} calls only the scoped RPC and preserves catalog filters`, async () => {
  const { action, form, calls, invalidated } = setup({ role });
  const result = await action(form);
  assert.deepEqual(calls, [{ name: "unpublish_panel", args: { p_event_id: eventId, p_panel_id: panelId } }]);
  const url = new URL(result.redirect, "https://local.invalid");
  assert.equal(url.pathname, "/dashboard/manager");
  for (const key of ["nav", "panelQ", "panelStatus", "panelDate", "panelLocation"]) assert.equal(url.searchParams.get(key), form.get(key));
  assert.equal(url.searchParams.get("panelSaved"), "unpublished");
  assert.ok(invalidated.includes("/") && invalidated.includes("/dashboard/partecipante"));
});
for (const options of [{role: "manager_viewer"}, {role: "participant"}, {role: "manager", roleEvent: panelId}]) test(`forged withdrawal is rejected: ${JSON.stringify(options)}`, async () => {
  const { action, form, calls } = setup(options);
  assert.equal((await action(form)).status, "error"); assert.equal(calls.length, 0);
});
test("malformed IDs are rejected before RPC; foreign return paths cannot redirect off site", async () => {
  const { action, form, calls } = setup(); form.set("panelId", "bad");
  assert.equal((await action(form)).status, "error"); assert.equal(calls.length, 0);
  form.set("panelId", panelId); form.set("sourceDashboard", "https://evil.invalid"); form.set("returnPath", "https://evil.invalid");
  assert.ok((await action(form)).redirect.startsWith("/dashboard/manager?"));
});
for (const error of ["42501", "P0002", "08006"]) test(`RPC ${error} keeps the confirmation open without reporting success`, async () => {
  const { action, form, invalidated } = setup({ error });
  assert.equal((await action(form)).status, "error"); assert.equal(invalidated.length, 0);
});
test("session and management gate cannot be bypassed", async () => {
  for (const options of [{ loggedOut: true }, { gateDenied: true }]) {
    const { action, form, calls } = setup(options); await assert.rejects(action(form)); assert.equal(calls.length, 0);
  }
});
