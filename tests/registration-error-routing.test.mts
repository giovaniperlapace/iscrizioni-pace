import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import * as links from "../lib/groups/registration-links.ts";

const source = readFileSync(new URL("../app/actions.ts", import.meta.url), "utf8");
const action = source.slice(source.indexOf("export async function submitPublicRegistration("), source.indexOf("export async function updateParticipantDashboard("));

for (const token of ["gruppo_roma", "", "//external.test"]) {
  for (const failure of ["validation", "rate-limit", "save"]) {
    test(`registration retains its entry point: ${token || "general"}, ${failure}`, async () => {
      const email = "name+test@example.test";
      let writes = 0;
      const dependencies = {
        ...links,
        parseRegistrationForm: () => failure === "validation" ? { ok: false, errors: ["Invalid data"] } : { ok: true, value: { email } },
        normalizeEmail: () => email,
        getRequestLocale: async () => "fr",
        getIpAddress: async () => "local",
        checkRateLimit: () => failure !== "rate-limit",
        REGISTRATION_RATE_LIMIT: {},
        headers: async () => ({ get: () => null }),
        createSupabaseServiceClient: () => ({}),
        createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
        createPublicRegistration: async () => { writes++; throw new Error("Save failed"); },
        getPublicSiteUrl: () => "https://example.test",
        getPublicRegistrationErrorMessage: (error: Error) => error.message,
        redirect: (path: string) => { throw new Error(path); },
      };
      const js = ts.transpileModule(action.replace("export ", ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
      const submit = new Function(...Object.keys(dependencies), `${js}; return submitPublicRegistration;`)(...Object.values(dependencies));
      const form = new FormData();
      if (token) form.set("groupRegistrationLinkToken", token);
      await assert.rejects(submit(form), (error: Error) => {
        const url = new URL(error.message, "https://example.test");
        assert.equal(url.origin, "https://example.test");
        assert.equal(url.pathname, token === "gruppo_roma" ? "/gruppo_roma" : "/registrazione");
        assert.equal(url.searchParams.get("email"), email);
        assert.equal(url.searchParams.get("error"), failure === "validation" ? "Invalid data" : failure === "rate-limit" ? "rate-limit" : "Save failed");
        if (token === "//external.test") assert.equal(url.searchParams.get("groupLink"), token);
        return true;
      });
      assert.equal(writes, failure === "save" ? 1 : 0);
    });
  }
}

test("unavailable group link never falls back to general registration options", async () => {
  const pageSource = readFileSync(new URL("../app/registrazione/registration-page-content.tsx", import.meta.url), "utf8");
  const calls: unknown[] = [];
  const dependencies: Record<string, unknown> = {
    "react/jsx-runtime": { jsx: (type: unknown, props: unknown) => ({ type, props }), jsxs: (type: unknown, props: unknown) => ({ type, props }) },
    "@/app/registrazione/registration-form": { RegistrationForm: "RegistrationForm" },
    "@/components/event-identity": { EventIdentity: "EventIdentity" },
    "@/lib/i18n/messages": { getMessages: () => ({ registrationClosed: { title: "Unavailable", body: "Closed", groupLinkError: "Link unavailable" } }) },
    "@/lib/i18n/server": { getRequestLocale: async () => "en" },
    "@/lib/supabase/service": { createSupabaseServiceClient: () => ({}) },
    "@/lib/registrations/public-flow": {
      getPublicRegistrationOptions: async (_db: unknown, token: unknown) => { calls.push(token); throw new Error("Link expired"); },
    },
  };
  const js = ts.transpileModule(pageSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports: Record<string, (args: unknown) => Promise<unknown>> = {};
  new Function("require", "exports", js)((name: string) => {
    assert.ok(name in dependencies, name);
    return dependencies[name];
  }, exports);
  const result = JSON.stringify(await exports.RegistrationPageContent({ searchParams: {}, groupRegistrationLinkToken: "gruppo_roma" }));
  assert.deepEqual(calls, ["gruppo_roma"]);
  assert.ok(result.includes("Link unavailable"));
  assert.ok(!result.includes("Link expired"));
  assert.ok(!result.includes('"type":"RegistrationForm"'));
});
