import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../app/actions.ts", import.meta.url), "utf8");
function actionHarness(actorRole = "manager", actorEvent = "event", profileExists = true) {
  const writes: Array<{ table: string; value: Record<string, unknown> }> = [];
  const reads: string[] = [];
  const db = { from(table: string) {
    reads.push(table);
    const query = {
      select() { return this; }, eq() { return this; }, is() { return this; }, limit() { return this; },
      maybeSingle() { return Promise.resolve({ data: table === "profiles" && profileExists ? { id: "existing", email: "existing@example.test", full_name: "Nome originale" } : null, error: null }); },
      insert(value: Record<string, unknown>) { writes.push({ table, value }); return { error: null }; },
      data: [], error: null,
    };
    return query;
  } };
  const dependencies = {
    validateContactFields: () => [], formFailure: (value: unknown) => value,
    optionalText: (value: unknown) => typeof value === "string" && value ? value : null,
    normalizeEmail: (value: unknown) => String(value ?? "").trim().toLowerCase(),
    getOperationalUsersDashboardPath: () => "/dashboard/manager?section=ruoli",
    parseGroupLeaderKind: () => "secondary", isAssignableOperationalRole: (role: string) => ["manager", "accoglienza", "admin"].includes(role),
    formFailureFromRedirect: (path: string) => path,
    createSupabaseServerClient: async () => db, createSupabaseServiceClient: () => db,
    getCurrentAuthContext: async () => ({ user: { id: "actor" }, eventRoles: [{ role: actorRole, eventId: actorEvent }] }),
    getCurrentOperationalEventId: async () => "event",
    ensureAuthUserForGroupLeader: () => { throw new Error("Must not create an account"); },
    syncOperationalIdentityByEmail: () => { throw new Error("Must not overwrite identity"); },
    hashEmailForAudit: () => "email-hash", revalidatePath: () => {},
    redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); },
  };
  const code = source.slice(source.indexOf("export async function assignOperationalUserRole"), source.indexOf("export async function updateOperationalUserRole")).replace("export async", "async");
  const js = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const action = new Function(...Object.keys(dependencies), `${js}; return assignOperationalUserRole;`)(...Object.values(dependencies));
  const form = new FormData();
  for (const [key, value] of Object.entries({ sourceDashboard: "manager", mode: "existing", existingUserId: "existing", role: "accoglienza" })) form.set(key, value);
  return { action, form, writes, reads };
}

test("assigns a first reception role to an existing account without creating or renaming it", async () => {
  const { action, form, writes } = actionHarness();
  form.set("firstName", "Forged"); form.set("lastName", "Name"); form.set("email", "forged@example.test");
  await assert.rejects(action(form), /REDIRECT:.*roleSaved=1/);
  assert.deepEqual(writes[0], { table: "event_user_roles", value: { user_id: "existing", event_id: "event", role: "accoglienza", created_by: "actor" } });
  assert.equal(writes[1].table, "audit_logs");
  assert.equal(writes.length, 2);
});

test("existing mode requires an explicit selection and rejects missing accounts", async () => {
  const missing = actionHarness("manager", "event", false);
  assert.match(await missing.action(missing.form), /roleError=invalid/);
  assert.equal(missing.writes.length, 0);
  const empty = actionHarness(); empty.form.delete("existingUserId");
  assert.match(await empty.action(empty.form), /roleError=invalid/);
  assert.equal(empty.reads.length, 0);
});

test("viewers and managers of another event cannot assign roles; global admin remains protected", async () => {
  for (const [role, event, target] of [["manager_viewer", "event", "accoglienza"], ["manager", "other", "accoglienza"], ["manager", "event", "admin"]]) {
    const h = actionHarness(role, event); h.form.set("role", target);
    assert.match(await h.action(h.form), /roleError=forbidden/);
    assert.equal(h.writes.length, 0);
    assert.equal(h.reads.length, 0);
  }
});

test("candidate directory includes users without roles and loads beyond 1,000 accounts", async () => {
  const code = readFileSync(new URL("../lib/operational-users/role-candidates.ts", import.meta.url), "utf8");
  const js = ts.transpileModule(code.replace("export async function", "async function"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const load = new Function("exports", `${js}; return loadRoleCandidates;`)({});
  const rows = Array.from({ length: 1101 }, (_, i) => ({ id: String(i), full_name: `Persona ${i}`, email: `${i}@example.test` }));
  const offsets: number[] = [];
  const db = { from(table: string) {
    assert.equal(table, "profiles");
    return { select() { return this; }, order() { return this; }, range(start: number, end: number) { offsets.push(start); return { data: rows.slice(start, end + 1), error: null }; } };
  } };
  assert.equal((await load(db)).length, 1101);
  assert.deepEqual(offsets, [0, 500, 1000]);
  await assert.rejects(load({ from() { return { select() { return this; }, order() { return this; }, range() { return { error: new Error("db") }; } }; } }), /Impossibile caricare/);
});
