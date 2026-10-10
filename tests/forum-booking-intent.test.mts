import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { parseForumIntent, forumBookingPath, withForumIntent } from "../lib/panels/booking-intent.ts";
import { getHomePanelSlots } from "../lib/events/home-program.ts";
import { getEventProgramCopy } from "../lib/events/program-copy.ts";
import type { PublicPanelProgramItem } from "../lib/panels/public-program.ts";

const forum = "99999999-9999-4999-8999-999999999999";
function loadFunction(path: string, name: string, deps: Record<string, unknown>) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.ok(fn);
  const js = ts.transpileModule(fn.getText(ast).replace(/^export /, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(deps), `${js}; return ${name};`)(...Object.values(deps));
}

class Redirect extends Error { readonly path: string; constructor(path: string) { super(path); this.path = path; } }
async function destination(action: (form: FormData) => Promise<void>, form: FormData) {
  try { await action(form); } catch (error) { assert.ok(error instanceof Redirect); return new URL(error.path, "https://example.test"); }
  throw new Error("Expected redirect");
}

test("forum intent accepts IDs only and always constructs a fixed internal destination", () => {
  assert.equal(parseForumIntent(forum), forum);
  assert.equal(forumBookingPath(forum), `/dashboard/partecipante?forum=${forum}#forum-${forum}`);
  for (const value of [undefined, null, [forum], "//evil.test", "/dashboard/admin", forum + "&role=admin", "%2f%2fevil.test", "invalid"]) {
    assert.equal(parseForumIntent(value), null);
    assert.equal(forumBookingPath(value), "/dashboard/partecipante");
  }
  const retry = new URL(withForumIntent("/registrazione?email=test%2Bname%40example.test&error=failed", forum), "https://example.test");
  assert.equal(retry.searchParams.get("email"), "test+name@example.test");
  assert.equal(retry.searchParams.get("error"), "failed");
  assert.equal(retry.searchParams.get("forum"), forum);
});

test("login destination is restricted to the current published catalog and the open mode", async () => {
  let reads = 0, mode = "internal";
  const resolve = loadFunction("../lib/panels/booking-intent.server.ts", "resolvePublicForumIntent", {
    parseForumIntent, getPanelReleaseMode: async () => mode,
    getPublicPanelProgram: async () => { reads++; return [{ id: forum }]; },
  });
  assert.equal(await resolve({}, "//evil.test"), null);
  assert.equal(await resolve({}, forum), null);
  mode = "catalog";
  assert.equal(await resolve({}, forum), null);
  assert.equal(reads, 0);
  mode = "open";
  assert.equal(await resolve({}, forum), forum);
  assert.equal(await resolve({}, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"), null);
  assert.equal(reads, 2);
});

for (const mode of ["existing", "new", "limited", "failed", "closed"] as const) test(`email entry preserves the selected forum: ${mode}`, async () => {
  const sends: string[] = [];
  const action = loadFunction("../app/actions.ts", "startPublicEmailFlow", {
    parseForumIntent, forumBookingPath, withForumIntent,
    resolvePublicForumIntent: async (_db: unknown, value: unknown) => mode === "closed" ? null : parseForumIntent(value),
    normalizeEmail: (value: unknown) => String(value), getAppUrl: () => "https://example.test", getIpAddress: async () => "synthetic",
    checkRateLimit: () => true, EMAIL_RATE_LIMIT: {}, createSupabaseServiceClient: () => ({}),
    getPublicRegistrationOptions: async () => ({ event: { id: "current" } }), hasExistingAppAccessForEmail: async () => mode !== "new",
    hashEmailForAudit: () => "synthetic", hasRecentMagicLinkSend: async () => mode === "limited",
    sendMagicLinkEmail: async (_db: unknown, _email: unknown, url: string) => { if (mode === "failed") throw new Error("synthetic failure"); sends.push(url); },
    logMagicLinkSent: async () => {}, logEmailFailure: async () => {}, getPublicEmailErrorMessage: () => "failed",
    redirect: (path: string) => { throw new Redirect(path); },
  });
  const form = new FormData(); form.set("email", "test@example.test"); form.set("forum", forum);
  const url = await destination(action, form);
  if (mode === "new") { assert.equal(url.pathname, "/registrazione"); assert.equal(url.searchParams.get("forum"), forum); }
  if (mode === "existing" || mode === "closed") {
    assert.equal(url.searchParams.get("sent"), "magic-link");
    assert.equal(new URL(sends[0]).searchParams.get("redirect_to"), forumBookingPath(mode === "closed" ? null : forum));
  }
  if (mode === "limited" || mode === "failed") {
    assert.equal(sends.length, 0);
    assert.equal(url.searchParams.get("error"), mode === "limited" ? "rate-limit" : "failed");
    assert.equal(url.searchParams.get("forum"), forum);
  }
});

for (const mode of ["success", "validation", "limited", "failed"] as const) test(`new registration retains forum through confirmation and retries: ${mode}`, async () => {
  const sites: string[] = [];
  const action = loadFunction("../app/actions.ts", "submitPublicRegistration", {
    parseForumIntent, withForumIntent, normalizeEmail: () => "test@example.test",
    parseRegistrationForm: () => mode === "validation" ? { ok: false, errors: ["invalid"] } : { ok: true, value: { email: "test@example.test" } },
    getIpAddress: async () => "synthetic", checkRateLimit: () => mode !== "limited", REGISTRATION_RATE_LIMIT: {},
    buildRegistrationRetryPath: ({ error }: { error: string }) => `/registrazione?error=${error}`,
    headers: async () => ({ get: () => null }), createSupabaseServiceClient: () => ({}),
    resolvePublicForumIntent: async () => forum,
    createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
    getRequestLocale: async () => "it", getPublicSiteUrl: () => "https://example.test",
    createPublicRegistration: async (_db: unknown, _input: unknown, _meta: unknown, site: string) => { if (mode === "failed") throw new Error("failed"); sites.push(site); },
    getPublicRegistrationErrorMessage: () => "failed", redirect: (path: string) => { throw new Redirect(path); },
  });
  const form = new FormData(); form.set("forum", forum);
  const url = await destination(action, form);
  assert.equal(url.searchParams.get("forum"), forum);
  assert.equal(url.pathname, mode === "success" ? "/registrazione/conferma" : "/registrazione");
  if (mode === "success") assert.equal(new URL(sites[0]).pathname, `/forum/${forum}`);
  else assert.equal(sites.length, 0);
});

test("forum numbers determine ordering within the time envelope, including forum 9 starting at 17", () => {
  const base: PublicPanelProgramItem = { id: "base", title: "Forum 11", startsAt: "2026-10-26T16:00:00+01:00", endsAt: "2026-10-26T18:00:00+01:00", description: null, locationName: "Room", locationAddress: null, availability: "available" };
  const items = [base, { ...base, id: "nine", title: "Forum 9 – Title", startsAt: "2026-10-26T17:00:00+01:00" }, { ...base, id: "ten", title: "Forum 10" }, { ...base, id: "morning", title: "Forum 2", startsAt: "2026-10-26T09:30:00+01:00", endsAt: "2026-10-26T12:30:00+01:00" }];
  const slots = getHomePanelSlots(items);
  assert.deepEqual(slots.map(slot => slot.panels.map(panel => panel.id)), [["morning"], ["nine", "ten", "base"]]);
  assert.equal(slots[1].startsAt, base.startsAt);
  assert.equal(slots[1].panels[0].startsAt, items[1].startsAt);
  assert.equal(items[0].id, "base");
  for (const locale of ["it", "en", "fr", "de", "es", "nl", "uk"] as const) {
    const copy = getEventProgramCopy(locale);
    assert.ok(copy.bookForum && copy.bookingInstruction && copy.selectedInstruction && copy.waitlistInstruction);
  }
  assert.equal(getEventProgramCopy("it").seats, "Posti disponibili");
});

test("participant booking screen highlights the requested forum with one anchor across multiple seat sections", async () => {
  const runtime = await import("react/jsx-runtime");
  const { renderToStaticMarkup } = await import("react-dom/server");
  let writes = 0;
  const source = readFileSync(new URL("../app/dashboard/partecipante/participant-panel-bookings.tsx", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const dependencies: Record<string, unknown> = {
    "react/jsx-runtime": runtime,
    "@/lib/events/program-copy": { getEventProgramCopy },
    "lucide-react": Object.fromEntries(["CalendarDays", "CheckCircle2", "Clock3", "MapPin", "Users"].map(name => [name, () => null])),
    "@/app/actions": { setParticipantPanelBooking: async () => { writes++; } },
    "@/components/pending-submit-button": { PendingSubmitButton: (props: Record<string, unknown>) => { const { pendingLabel, ...buttonProps } = props; void pendingLabel; return runtime.jsx("button", buttonProps); } },
  };
  const exports: Record<string, (props: unknown) => ReturnType<typeof runtime.jsx>> = {};
  new Function("require", "exports", code)((name: string) => { assert.ok(name in dependencies, name); return dependencies[name]; }, exports);
  const row = { panel_id: forum, section_id: "one", audience_name: "Registered", title: "Forum 9", description: null, starts_at: "2026-10-26T16:00:00Z", ends_at: "2026-10-26T17:00:00Z", location_name: "Room", location_address: null, booking_status: "available", party_size: 1 };
  const html = renderToStaticMarkup(exports.ParticipantPanelBookings({ locale: "it", registrationId: "registration", rows: [row, { ...row, section_id: "two", booking_status: "full" }], requestedForum: forum }));
  assert.equal((html.match(new RegExp(`id="forum-${forum}"`, "g")) ?? []).length, 1);
  assert.match(html, /Forum scelto/);
  assert.match(html, /ring-offset-2/);
  assert.match(html, /disabled=""/);
  assert.equal(writes, 0, "following an intent never automatically reserves a seat");
});
