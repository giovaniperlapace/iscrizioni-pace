import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
const source = readFileSync(new URL("../app/actions.ts", import.meta.url), "utf8");
function harness(actor = "actor", role = "manager", eventId = "event", rpcError: unknown = null) {
  const calls: unknown[] = [];
  const db = { rpc: async (name: string, args: unknown) => { calls.push({ name, args }); return { error: rpcError }; } };
  const dependencies = {
    optionalText: (x: unknown) => typeof x === "string" && x ? x : null,
    getOperationalUsersDashboardPath: () => "/dashboard/manager?section=ruoli",
    isAssignableOperationalRole: (x: string) => ["manager", "manager_viewer", "capogruppo", "admin", "accoglienza"].includes(x),
    formFailureFromRedirect: (path: string) => path,
    formFailure: (issues: unknown) => ({ status: "error", issues }),
    createSupabaseServerClient: async () => db, createSupabaseServiceClient: () => db,
    getCurrentAuthContext: async () => ({ user: { id: actor }, eventRoles: [{ role, eventId }] }),
    resolveOperationalRoleTarget: async (_db: unknown, x: { eventId: string; groupId: string }) => ({ ok: true, ...x }),
    revalidatePath: () => {}, redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); },
  };
  const helper = source.slice(source.indexOf("function canManageOperationalRole("), source.indexOf("function getEventOpeningUpdate("));
  const action = source.slice(source.indexOf("export async function deleteOperationalUserRole("), source.indexOf("async function getExistingGroupLeaderTarget(")).replace("export async", "async");
  const js = ts.transpileModule(helper + action, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const run = new Function(...Object.keys(dependencies), `${js}; return deleteOperationalUserRole;`)(...Object.values(dependencies));
  const form = new FormData();
  Object.entries({ sourceDashboard: "manager", userId: "target", role: "capogruppo", eventId: "event", groupId: "group", confirmRemoval: "on", inline: "on" }).forEach(([k,v]) => form.set(k,v));
  return { run, form, calls };
}
test("removal calls the atomic scoped RPC and returns success without navigating", async () => {
  const h = harness(); assert.deepEqual(await h.run(h.form), { status: "success" });
  assert.deepEqual(h.calls, [{ name: "remove_operational_role", args: { p_actor_user_id: "actor", p_user_id: "target", p_role: "capogruppo", p_event_id: "event", p_group_id: "group" } }]);
});
test("self removal, missing confirmation, viewer and foreign manager fail before writes", async () => {
  for (const h of [harness("target"),harness("actor","manager_viewer"),harness("actor","manager","other")]) {
    assert.match(await h.run(h.form), /roleError/); assert.equal(h.calls.length,0);
  }
  const h=harness();h.form.delete("confirmRemoval");assert.match(await h.run(h.form),/roleError=invalid/);assert.equal(h.calls.length,0);
});
test("DB errors keep the form open and return a role-specific message", async () => {
  const h=harness("actor","manager","event",{code:"23503"});
  assert.deepEqual(await h.run(h.form),{status:"error",issues:[{field:null,code:"roleRemovalFailed"}]});
});
test("a manager cannot remove a global administrator",async()=>{const h=harness();h.form.set("role","admin");assert.match(await h.run(h.form),/forbidden/);assert.equal(h.calls.length,0);});
