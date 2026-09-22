import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { GROUP_DELETION_COPY } from "../lib/groups/deletion-copy.ts";
import { SUPPORTED_LOCALES } from "../lib/i18n/config.ts";

const id = "11111111-1111-4111-8111-111111111111";
const expected = "a".repeat(32);
const preview = { name: "Group", expected, children: 0, assignments: 1205, currentAssignments: 1100, memberships: 2, links: 1, rules: 0 };
function harness({ roles = [{ role: "manager", eventId: "event" }], auth = true, error = "", data = preview as unknown, throws = false } = {}) {
  const calls: Record<string, unknown>[] = []; const paths: string[] = [];
  const source = readFileSync("app/dashboard/groups/actions.ts", "utf8");
  const ast = ts.createSourceFile("actions.ts", source, ts.ScriptTarget.Latest, true);
  const fn = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "manageGroupDeletion");
  assert.ok(fn);
  const code = ts.transpileModule(fn.getText(ast).replace(/^export /, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const deps = {
    getCurrentAuthContext: async () => auth ? { user: { id: "session-actor" }, eventRoles: roles } : null,
    createSupabaseServerClient: async () => ({}),
    createSupabaseServiceClient: () => ({ rpc: async (name: string, args: Record<string, unknown>) => {
      assert.equal(name, "manage_group_deletion"); calls.push(args);
      if (throws) throw new Error("offline");
      return { error: error ? { code: error } : null, data };
    } }), revalidatePath: (path: string) => paths.push(path),
  };
  return { action: new Function(...Object.keys(deps), `${code}; return manageGroupDeletion;`)(...Object.values(deps)), calls, paths };
}
test("preview and confirmation bind identity to session; only successful deletion refreshes dashboards", async () => {
  const h = harness();
  assert.deepEqual(await h.action(id), { preview });
  assert.deepEqual(h.calls, [{ p_group_id: id, p_actor_user_id: "session-actor", p_delete: false, p_expected: null }]);
  assert.deepEqual(h.paths, []);
  const d = harness({ data: { deleted: true } });
  assert.deepEqual(await d.action(id, expected), { deleted: true });
  assert.equal(d.calls[0].p_expected, expected); assert.equal(d.calls[0].p_delete, true);
  for (const path of ["/dashboard/admin", "/dashboard/manager", "/dashboard/capogruppo", "/dashboard/partecipante", "/registrazione", "/"]) assert.ok(d.paths.includes(path));
});
test("unauthenticated users, viewers, leaders and malformed arguments never call deletion RPC", async () => {
  for (const options of [{ auth: false }, { roles: [] }, { roles: [{ role: "capogruppo", eventId: "event" }] }, { roles: [{ role: "manager_viewer", eventId: "event" }] }, { roles: [{ role: "admin", eventId: "event" }] }]) {
    const h = harness(options); assert.deepEqual(await h.action(id, expected), { error: "forbidden" }); assert.equal(h.calls.length, 0);
  }
  for (const args of [["invalid"], [id, ""], [id, "{}"], [id, "z".repeat(32)]]) {
    const h = harness(); assert.deepEqual(await h.action(...args), { error: "failed" }); assert.equal(h.calls.length, 0);
  }
});
test("RPC scope errors, stale confirmation, blockers and transport failures never report success", async () => {
  for (const [error, message] of [["42501", "forbidden"], ["PT409", "conflict"], ["P0002", "missing"], ["P0003", "children"], ["XX000", "failed"]]) {
    const h = harness({ error }); assert.deepEqual(await h.action(id, expected), { error: message }); assert.equal(h.paths.length, 0);
  }
  const h = harness({ throws: true }); assert.deepEqual(await h.action(id, expected), { error: "failed" });
  for (const data of [null, {}, { ...preview, assignments: -1 }, { ...preview, memberships: "2" }]) {
    const invalid = harness({ data }); assert.deepEqual(await invalid.action(id), { error: "failed" });
  }
  assert.deepEqual(await harness({ data: preview }).action(id, expected), { error: "failed" });
});
test("all seven languages explain that people remain and only group links are removed", () => {
  for (const locale of SUPPORTED_LOCALES) {
    const copy = GROUP_DELETION_COPY[locale];
    assert.deepEqual(Object.keys(copy).sort(), Object.keys(GROUP_DELETION_COPY.it).sort());
    assert.ok(Object.values(copy).every(value => typeof value === "string" && value.length > 0));
    assert.ok(copy.impact.includes("QR"));
  }
});
