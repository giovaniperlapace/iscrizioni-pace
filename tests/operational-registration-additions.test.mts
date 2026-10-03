import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { parseOperationalChild } from "../lib/registrations/operational-child.ts";
import { formFailure } from "../lib/forms/result.ts";
const id = "11111111-1111-4111-8111-111111111111";
function harness(auth = true, error = "") {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const paths: string[] = [];
  const source = readFileSync("app/dashboard/operational-registration-actions.ts", "utf8");
  const ast = ts.createSourceFile("actions.ts", source, ts.ScriptTarget.Latest, true);
  const stripped = ast.statements.filter(n => !ts.isImportDeclaration(n)).map(n => n.getText(ast).replace(/^export /, "")).join("\n");
  const code = ts.transpileModule(stripped, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const deps = {
    revalidatePath: (p: string) => paths.push(p),
    getCurrentAuthContext: async () => auth ? { user: { id: "session-actor" } } : null,
    createSupabaseServerClient: async () => ({}),
    createSupabaseServiceClient: () => ({ rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      if (error === "network") throw new Error("offline");
      return { data: null, error: error ? { code: error } : null };
    } }), formFailure, parseOperationalChild,
    ACCESSIBILITY_DIFFICULTIES: ["hearing", "walkingOrSteps", "wheelchairOrMobilityAid"].map(key => ({ key })),
  };
  const actions = new Function(...Object.keys(deps), `${code}; return {addOperationalChild,getOperationalAccessibility,updateOperationalAccessibility};`)(...Object.values(deps));
  return { ...actions, calls, paths };
}
function form() {
  const data = new FormData();
  for (const [key, value] of Object.entries({ registrationId: id, childId: id, firstName: " Anna  Maria ", lastName: " Rossi ", birthDate: "2016-02-29", actorUserId: "forged", expected: "null", accessibility_walkingOrSteps: "on" })) data.set(key, value);
  return data;
}
test("add action validates input, uses authenticated actor and refreshes all dashboards", async () => {
  const h = harness(); assert.deepEqual(await h.addOperationalChild(form()), { status: "success" });
  assert.equal(h.calls[0].name, "add_operational_child");
  assert.equal(h.calls[0].args.p_actor_user_id, "session-actor");
  assert.deepEqual(h.calls[0].args.p_child, { first_name: "Anna Maria", last_name: "Rossi", birth_date: "2016-02-29" });
  assert.equal(h.paths.length, 4);
  for (const [key, value] of [["registrationId", "bad"], ["childId", "bad"], ["birthDate", "2025-02-30"], ["firstName", ""], ["lastName", "x".repeat(121)]]) {
    const invalid = harness(); const data = form(); data.set(key, value);
    assert.equal((await invalid.addOperationalChild(data)).status, "error"); assert.equal(invalid.calls.length, 0);
  }
});
test("accessibility sends only questionnaire keys and preserves snapshot for conflict checks", async () => {
  const h = harness(); const data = form(); data.set("accessibility_injected", "on");
  assert.equal((await h.updateOperationalAccessibility(data)).status, "success");
  assert.deepEqual(h.calls[0].args, { p_registration_id: id, p_actor_user_id: "session-actor", p_expected: null,
    p_answers: { hearing: false, walkingOrSteps: true, wheelchairOrMobilityAid: false } });
  assert.equal(h.paths.length, 4);
  const invalid = harness(); data.set("expected", "bad");
  assert.equal((await invalid.updateOperationalAccessibility(data)).status, "error"); assert.equal(invalid.calls.length, 0);
});
test("accessibility absence is a successful null snapshot, errors never become empty data", async () => {
  const h = harness(); assert.deepEqual(await h.getOperationalAccessibility(id), { status: "success", snapshot: null });
  assert.equal(h.calls[0].args.p_actor_user_id, "session-actor"); assert.equal(h.paths.length, 0);
  assert.equal((await h.getOperationalAccessibility("bad")).status, "error"); assert.equal(h.calls.length, 1);
});
test("unauthenticated calls never access service RPCs", async () => {
  const h = harness(false);
  for (const [name, input] of [["addOperationalChild", form()], ["getOperationalAccessibility", id], ["updateOperationalAccessibility", form()]] as const) {
    assert.equal((await h[name](input)).status, "error");
  }
  assert.equal(h.calls.length, 0);
});
test("all actions surface forbidden, stale and network failures without success/revalidation", async () => {
  for (const [error, code] of [["42501", "forbidden"], ["PT409", "conflict"], ["40001", "conflict"], ["network", "failed"]]) {
    const h = harness(true, error);
    for (const [name, input] of [["addOperationalChild", form()], ["getOperationalAccessibility", id], ["updateOperationalAccessibility", form()]] as const) {
      assert.deepEqual(await h[name](input), formFailure([{ field: null, code }]));
    }
    assert.equal(h.paths.length, 0);
  }
});
