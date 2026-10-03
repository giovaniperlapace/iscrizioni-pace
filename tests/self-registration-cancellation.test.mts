import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";
import { SELF_CANCELLATION_COPY } from "../lib/registrations/self-cancellation-copy.ts";
import { SUPPORTED_LOCALES } from "../lib/i18n/config.ts";

const source = readFileSync(new URL("../app/dashboard/partecipante/cancellation-actions.ts", import.meta.url), "utf8");
const action = source.slice(source.indexOf("export async function"));
const compiled = ts.transpileModule(action.replace("export async", "async"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const id = "11111111-1111-4111-8111-111111111111";
function fixture({ authenticated = true, rpcError = false, role = "partecipante" } = {}) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const invalidated: string[] = [];
  const db = createClient("https://example.test", "test", { global: { fetch: async (input, init) => {
    calls.push({ url: String(input), body: JSON.parse(String(init?.body)) });
    return rpcError ? new Response(JSON.stringify({ code: "42501", message: "Unavailable" }), { status: 403 }) : new Response(null, { status: 204 });
  } } });
  const deps = {
    createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: authenticated ? { id: "session-user", role } : null }, error: null }) } }),
    createSupabaseServiceClient: () => db,
    revalidatePath: (path: string) => invalidated.push(path),
  };
  return { cancel: new Function(...Object.keys(deps), `${compiled}; return cancelOwnRegistration;`)(...Object.values(deps)), calls, invalidated };
}
for (const role of ["partecipante", "capogruppo", "manager", "admin"]) test(`own cancellation derives actor from session (${role})`, async () => {
  const { cancel, calls, invalidated } = fixture({ role });
  assert.deepEqual(await cancel(id, true), { success: true });
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /rpc\/cancel_own_registration$/);
  assert.deepEqual(calls[0].body, { p_registration_id: id, p_actor_user_id: "session-user" });
  assert.deepEqual(invalidated, ["/dashboard"]);
});
test("no confirmation or invalid registration cannot reach database", async () => {
  const { cancel, calls } = fixture();
  for (const [value, confirm] of [[id, false], [id, "true"], ["bad", true], [null, true]]) assert.equal((await cancel(value, confirm)).error, "failed");
  assert.equal(calls.length, 0);
});
test("expired session cannot cancel", async () => {
  const { cancel, calls } = fixture({ authenticated: false });
  assert.equal((await cancel(id, true)).error, "session");
  assert.equal(calls.length, 0);
});
test("ownership or database errors remain failures without cache success", async () => {
  const { cancel, invalidated } = fixture({ rpcError: true });
  assert.equal((await cancel(id, true)).error, "failed");
  assert.deepEqual(invalidated, []);
});
test("cancellation copy covers all seven locales and all consequences", () => {
  for (const locale of SUPPORTED_LOCALES) {
    assert.deepEqual(Object.keys(SELF_CANCELLATION_COPY[locale]), Object.keys(SELF_CANCELLATION_COPY.it));
    for (const text of Object.values(SELF_CANCELLATION_COPY[locale])) assert.ok(text.trim().length > 0);
    assert.match(SELF_CANCELLATION_COPY[locale].impact, /QR/);
    assert.match(SELF_CANCELLATION_COPY[locale].again, /QR/);
  }
});
