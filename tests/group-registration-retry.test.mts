import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { SUPPORTED_LOCALES, type SupportedLocale } from "../lib/i18n/config.ts";
import { buildRegistrationRetryPath } from "../lib/groups/registration-links.ts";
import { normalizeEmail, parseRegistrationForm } from "../lib/registrations/validation.ts";

function loadFunction(path: string, name: string, deps: Record<string, unknown>) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const fn = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.ok(fn);
  const js = ts.transpileModule(fn.getText(ast).replace(/^export /, ""), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
  }).outputText;
  return new Function(...Object.keys(deps), `${js}; return ${name};`)(...Object.values(deps));
}

class Redirect extends Error {
  readonly path: string;
  constructor(path: string) { super(path); this.path = path; }
}
function validForm(token: string | null) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    email: "leader+test@example.org", firstName: "Test", lastName: "Persona",
    birthDate: "1990-01-02", birthPlace: "Italia, Roma", nationality: "Italian (Italy)",
    countryOther: "Italia", cityOther: "Roma", hasAccessibilityNeeds: "no",
    hasPreviousSantegidioParticipation: "yes", participatesWithGroup: "yes",
    availabilityUnknown: "on", privacyAccepted: "on", dataProcessingAccepted: "on",
    groupId: "11111111-1111-4111-8111-111111111111",
  })) data.set(key, value);
  if (token) data.set("groupRegistrationLinkToken", token);
  return data;
}

function actionHarness(mode: "validation" | "rate-limit" | "save-error" | "success", locale: SupportedLocale = "fr") {
  const saved: Array<{ groupRegistrationLinkToken: string | null; preferredLocale: SupportedLocale }> = [];
  const action = loadFunction("../app/actions.ts", "submitPublicRegistration", {
    parseRegistrationForm, normalizeEmail, buildRegistrationRetryPath,
    getRequestLocale: async () => locale,
    getIpAddress: async () => "local", REGISTRATION_RATE_LIMIT: {},
    checkRateLimit: () => mode !== "rate-limit",
    headers: async () => ({ get: () => null }),
    createSupabaseServiceClient: () => ({}),
    createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
    createPublicRegistration: async (_db: unknown, input: { groupRegistrationLinkToken: string | null; preferredLocale: SupportedLocale }) => {
      if (mode === "save-error") throw new Error("Errore di salvataggio & riprova");
      saved.push(input);
    },
    getPublicSiteUrl: () => "https://example.test",
    getPublicRegistrationErrorMessage: (error: Error) => error.message,
    redirect: (path: string) => { throw new Redirect(path); },
  });
  return { action, saved };
}
async function destination(action: (form: FormData) => Promise<void>, form: FormData) {
  try { await action(form); } catch (error) {
    assert.ok(error instanceof Redirect);
    return new URL(error.path, "https://example.test");
  }
  throw new Error("Expected redirect");
}

for (const token of ["fiumicino", null]) for (const mode of ["validation", "rate-limit", "save-error"] as const) {
  test(`${mode} preserves ${token ?? "generic"} registration context through correction`, async () => {
    const form = validForm(token);
    if (mode === "validation") form.delete("firstName");
    const harness = actionHarness(mode);
    const url = await destination(harness.action, form);
    assert.equal(url.pathname, token ? "/fiumicino" : "/registrazione");
    assert.equal(url.searchParams.get("email"), "leader+test@example.org");
    assert.ok(url.searchParams.get("error"));
    assert.equal(harness.saved.length, 0);
    // Rebuild the corrected submission with the token supplied by the returned route.
    const corrected = validForm(token ? decodeURIComponent(url.pathname.slice(1)) : null);
    const success = actionHarness("success");
    const confirmation = await destination(success.action, corrected);
    assert.equal(confirmation.pathname, "/registrazione/conferma");
    assert.equal(success.saved[0].groupRegistrationLinkToken, token);
  });
}

for (const token of ["//evil.test/path", "../dashboard", "dashboard", "x&email=other", "a?b#c"]) {
  test(`malformed or reserved token stays on registration route: ${token}`, () => {
    const url = new URL(buildRegistrationRetryPath({ token, email: "x+y@example.org", error: "a&b" }), "https://example.test");
    assert.equal(url.origin, "https://example.test");
    assert.equal(url.pathname, "/registrazione");
    assert.equal(url.searchParams.get("groupLink"), token);
    assert.equal(url.searchParams.get("email"), "x+y@example.org");
    assert.equal(url.searchParams.get("error"), "a&b");
  });
}

type Element = { type: unknown; props: Record<string, unknown>; children: Element[] };
const React = { createElement: (type: unknown, props: Record<string, unknown>, ...children: Element[]) => ({ type, props, children }) };
function flatten(node: Element): Element[] {
  if (!node || typeof node !== "object") return [];
  return [node, ...node.children.flatMap(flatten)];
}
function pageHarness(fail: boolean) {
  const lookups: Array<string | null> = [];
  const RegistrationForm = () => null;
  const page = loadFunction("../app/registrazione/registration-page-content.tsx", "RegistrationPageContent", {
    React, RegistrationForm, EventIdentity: () => null,
    getRequestLocale: async () => "en",
    getMessages: () => ({ registrationClosed: { groupLinkError: "Invalid group link" } }),
    createSupabaseServiceClient: () => ({}),
    getPublicRegistrationOptions: async (_db: unknown, token: string | null) => {
      lookups.push(token);
      if (fail) throw new Error("Link unavailable");
      return { event: { id: "event" }, groupLink: token ? { groupId: "fiumicino-group", displayLabel: "Fiumicino" } : null };
    },
    getRegistrationIdentitySuggestionForEmail: async () => null,
  });
  return { page, lookups, RegistrationForm };
}

test("returned group page supplies the same group and error to the form", async () => {
  const harness = pageHarness(false);
  const tree = await harness.page({ searchParams: { email: "x@example.org", error: "invalid" }, groupRegistrationLinkToken: "fiumicino" });
  const form = flatten(tree).find(node => node.type === harness.RegistrationForm)!;
  assert.ok(form);
  assert.equal(form.props.groupRegistrationLinkToken, "fiumicino");
  assert.equal(form.props.error, "invalid");
  assert.deepEqual(harness.lookups, ["fiumicino"]);
});

test("unavailable invitation renders an alert without loading a generic form", async () => {
  const harness = pageHarness(true);
  const tree = await harness.page({ searchParams: {}, groupRegistrationLinkToken: "fiumicino" });
  assert.deepEqual(harness.lookups, ["fiumicino"]);
  assert.ok(flatten(tree).some(node => node.props?.role === "alert"));
  assert.ok(!flatten(tree).some(node => node.type === harness.RegistrationForm));
});

test("generic lookup failure propagates instead of silently retrying", async () => {
  const harness = pageHarness(true);
  await assert.rejects(harness.page({ searchParams: {} }), /Link unavailable/);
  assert.deepEqual(harness.lookups, [null]);
});

test("invalid invitation is rejected before any participant or registration write", async () => {
  let writes = 0;
  const create = loadFunction("../lib/registrations/public-flow.ts", "createPublicRegistration", {
    getCurrentPublicEvent: async () => ({ id: "event" }),
    hasExistingRegistrationForEmail: async () => false,
    resolveActiveGroupRegistrationLink: async () => { throw new Error("Invalid invitation"); },
    resolveParticipantGeography: async () => ({}),
  });
  await assert.rejects(create({ from: () => { writes++; throw new Error("Unexpected write"); } }, { email: "x@example.org", groupRegistrationLinkToken: "expired" }), /Invalid invitation/);
  assert.equal(writes, 0);
});

for (const locale of SUPPORTED_LOCALES) {
  test(`public submission saves the interface locale ${locale} even if form data disagrees`, async () => {
    const harness = actionHarness("success", locale);
    const form = validForm(null);
    form.set("preferredLocale", locale === "it" ? "fr" : "it");
    const url = await destination(harness.action, form);
    assert.equal(url.pathname, "/registrazione/conferma");
    assert.equal(harness.saved[0].preferredLocale, locale);
  });
}
