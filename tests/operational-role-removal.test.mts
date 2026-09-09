import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../app/actions.ts", import.meta.url), "utf8");
function extract(name: string, next: string, dependencies: Record<string, unknown> = {}) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf(next, start);
  const code = source.slice(start, end).replace(/\nasync\s*$/, "");
  const js = ts.transpileModule(`${code}\nreturn ${name};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  // Async helpers retain await after extracting the declaration.
  const executable = name === "removeOperationalRoleAssignment" ? `async ${js}` : js;
  return new Function(...Object.keys(dependencies), executable)(...Object.values(dependencies));
}

test("role removal preserves the other roles, events and groups", async () => {
  const remove = extract("removeOperationalRoleAssignment", "function operationalRoleSignature");
  for (const role of ["manager", "manager_viewer", "accoglienza", "admin", "capogruppo"]) {
    const calls: unknown[][] = [];
    const query = {
      delete() { calls.push(["delete"]); return this; },
      eq(...args: unknown[]) { calls.push(["eq", ...args]); return this; },
      is(...args: unknown[]) { calls.push(["is", ...args]); return this; },
      error: null,
    };
    const db = { from(table: string) { calls.push(["from", table]); return query; } };
    assert.equal(await remove(db, { userId: "target", role, eventId: "event", groupId: "group" }), null);
    assert.deepEqual(calls, [
      ["from", role === "capogruppo" ? "group_memberships" : "event_user_roles"],
      ["delete"], ["eq", "user_id", "target"],
      ...(role === "capogruppo" ? [["eq", "group_id", "group"], ["eq", "role", role]] :
        [["eq", "role", role], [role === "admin" ? "is" : "eq", "event_id", role === "admin" ? null : "event"]]),
    ]);
  }
});

test("authorization excludes viewers, foreign events and non-admin global role removal", () => {
  const canManage = extract("canManageOperationalRole", "async function removeOperationalRoleAssignment");
  assert.equal(canManage([{ role: "manager", eventId: "a" }], false, { role: "capogruppo", eventId: "a" }), true);
  assert.equal(canManage([{ role: "manager", eventId: "a" }], false, { role: "capogruppo", eventId: "b" }), false);
  assert.equal(canManage([{ role: "manager_viewer", eventId: "a" }], false, { role: "accoglienza", eventId: "a" }), false);
  assert.equal(canManage([{ role: "manager", eventId: "a" }], false, { role: "admin", eventId: null }), false);
  assert.equal(canManage([], true, { role: "admin", eventId: null }), true);
});

test("removal requires explicit confirmation and rejects self-removal before writes", () => {
  const action = source.slice(source.indexOf("export async function deleteOperationalUserRole"), source.indexOf("async function getExistingGroupLeaderTarget"));
  assert.match(action, /formData.get\("confirmRemoval"\) !== "on"/);
  assert.ok(action.indexOf("userId === auth.user.id") < action.indexOf("removeOperationalRoleAssignment("));
});
