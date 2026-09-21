import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { parseOperationalChild } from "../lib/registrations/operational-child.ts";
import { formFailure } from "../lib/forms/result.ts";

function form(intent = "save") {
  const data = new FormData();
  for (const [key, value] of Object.entries({ childId: "11111111-1111-4111-8111-111111111111", intent,
    firstName: " Anna  Maria ", lastName: " Rossi ", birthDate: "1990-01-01",
    expected: JSON.stringify({ first_name: "Anna", last_name: "Rossi", birth_date: "1990-01-01" }),
    actorUserId: "forged", registrationId: "forged",
  })) data.set(key, value);
  return data;
}
test("operational edits normalize names, preserve historical adult dates, and exclude injected identity", () => {
  const parsed = parseOperationalChild(form());
  assert.ok(!("status" in parsed));
  assert.deepEqual(parsed.child, { first_name: "Anna Maria", last_name: "Rossi", birth_date: "1990-01-01" });
  assert.equal("actorUserId" in parsed, false);
  assert.equal("registrationId" in parsed, false);
});
test("invalid updates fail; removal does not depend on possibly erroneous editable fields", () => {
  for (const [key, value] of [["childId", "bad"], ["intent", "other"], ["expected", "null"], ["expected", "[]"], ["firstName", ""], ["lastName", "x".repeat(121)], ["birthDate", "2099-01-01"], ["birthDate", "2025-02-30"]]) {
    const data = form(); data.set(key, value);
    assert.equal("status" in parseOperationalChild(data), true, key);
  }
  const data = form("delete"); data.delete("firstName"); data.delete("lastName"); data.delete("birthDate");
  const result = parseOperationalChild(data);
  assert.ok(!("status" in result)); assert.equal(result.child, null);
});

function actionHarness(authenticated = true, failure = "") {
  const calls: Record<string, unknown>[] = [];
  const paths: string[] = [];
  const source = readFileSync("app/actions.ts", "utf8");
  const ast = ts.createSourceFile("actions.ts", source, ts.ScriptTarget.Latest, true);
  const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "updateOperationalChild");
  assert.ok(fn);
  const code = ts.transpileModule(fn.getText(ast).replace(/^export /, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const deps = {
    getCurrentAuthContext: async () => authenticated ? { user: { id: "real-actor" } } : null,
    createSupabaseServerClient: async () => ({}),
    createSupabaseServiceClient: () => ({ rpc: async (name: string, args: Record<string, unknown>) => {
      assert.equal(name, "update_operational_child"); calls.push(args);
      if (failure === "network") throw new Error("offline");
      return { error: failure ? { code: failure } : null };
    } }), parseOperationalChild, formFailure,
    revalidatePath: (path: string) => paths.push(path),
  };
  const action = new Function(...Object.keys(deps), `${code}; return updateOperationalChild;`)(...Object.values(deps));
  return { action, calls, paths };
}
test("server action binds actor to session and revalidates all affected dashboards after success", async () => {
  for (const intent of ["save", "delete"]) {
    const h = actionHarness();
    assert.deepEqual(await h.action(form(intent)), { status: "success" });
    assert.equal(h.calls[0].p_actor_user_id, "real-actor");
    assert.equal(h.paths.length, 4);
    assert.equal(h.calls[0].p_child === null, intent === "delete");
  }
});
test("unauthenticated/invalid requests never call RPC; errors and conflicts never report success", async () => {
  const noAuth = actionHarness(false);
  assert.equal((await noAuth.action(form())).status, "error"); assert.equal(noAuth.calls.length, 0);
  const invalid = actionHarness();
  assert.equal((await invalid.action(form("bad"))).status, "error"); assert.equal(invalid.calls.length, 0);
  for (const [failure, code] of [["42501", "forbidden"], ["40001", "conflict"], ["22023", "failed"], ["network", "failed"]]) {
    const h = actionHarness(true, failure);
    assert.deepEqual(await h.action(form()), formFailure([{ field: null, code }]));
    assert.equal(h.paths.length, 0);
  }
});
