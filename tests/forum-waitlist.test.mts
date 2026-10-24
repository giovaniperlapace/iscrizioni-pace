import { getForumRelayRoom } from "../lib/events/assisi-2026-relay-rooms.ts";
import { FORUM_RELAY_COPY } from "../lib/panels/relay-copy.ts";
import { validForumChildIds } from "../lib/panels/child-selection.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { renderForumWaitlistEmail, type ForumWaitlistOffer } from "../lib/panels/waitlist-email.ts";
import { FORUM_WAITLIST_COPY } from "../lib/panels/waitlist-copy.ts";

const panelId = "11111111-1111-4111-8111-111111111111";
const registrationId = "11111111-1111-4111-8111-111111111112";
const offer: ForumWaitlistOffer = { id: "offer", claim: "claim", eventId: "event", registrationId, panelId,
  name: "Synthetic <script>person</script>", email: "synthetic@example.invalid", locale: "it", title: 'Forum <img src=x onerror="x">', location: "Room & Test",
  startsAt: "2026-10-26T16:00:00+01:00", endsAt: "2026-10-26T17:00:00+01:00", expiresAt: "2026-10-14T13:30:00+02:00", seats: 1 };

for (const locale of ["it", "en", "fr", "de", "es", "nl", "uk"] as const) test(`Forum offer and queue instructions are complete in ${locale}`, () => {
  const email = renderForumWaitlistEmail({ ...offer, locale }, "https://example.invalid");
  assert.equal(email.subject, FORUM_WAITLIST_COPY[locale].emailSubject);
  assert.match(email.text, /2/);
  assert.ok(email.text.includes(FORUM_WAITLIST_COPY[locale].swap));
  assert.ok(email.text.includes(FORUM_WAITLIST_COPY[locale].deadline));
  assert.match(email.text, new RegExp(`/forum/${panelId}`));
  assert.match(email.text, /registrationspeace@santegidio.org/);
  assert.doesNotMatch(email.html, /<script>|<img/);
  assert.match(email.html, /&lt;script&gt;/);
  assert.match(email.text, /Europe\/Rome/);
});

test("offer links never confirm automatically and reject malformed Forum IDs and URL schemes", () => {
  const email = renderForumWaitlistEmail(offer, "https://example.invalid");
  assert.doesNotMatch(email.html, /token=|accept=|claim=|registrationId=/);
  assert.throws(() => renderForumWaitlistEmail({ ...offer, panelId: "//evil.invalid" }, "https://example.invalid"));
  assert.throws(() => renderForumWaitlistEmail(offer, "file:///tmp/test"));
});

function loadModule(file: string, dependencies: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports: Record<string, (...args: never[]) => unknown> = {};
  new Function("require", "exports", ...Object.keys(extra), code)((name: string) => {
    assert.ok(name in dependencies, name); return dependencies[name];
  }, exports, ...Object.values(extra));
  return exports;
}
class SyntheticDeliveryError extends Error { code: string; constructor(code: string) { super(code); this.code = code; } }
for (const scenario of ["sent", "failed", "unknown", "ack-failed", "config-failed", "expired"] as const) test(`notification worker handles ${scenario} without blind retries`, async () => {
  let claims = 0, sends = 0;
  const finishes: Record<string, unknown>[] = [];
  const db = { async rpc(name: string, args?: Record<string, unknown>) {
    if (name === "claim_panel_waitlist_notification") { claims++; return { data: claims === 1 ? { ...offer, expiresAt: scenario === "expired" ? "2000-01-01" : "2099-01-01" } : null }; }
    finishes.push(args!); return { error: scenario === "ack-failed" ? { message: "synthetic" } : null };
  } };
  const exports = loadModule("lib/panels/waitlist-delivery.server.ts", {
    "@/lib/supabase/service": { createSupabaseServiceClient: () => db },
    "@/lib/email/config": { getEmailConfig: () => { if (scenario === "config-failed") throw new Error("synthetic config"); return {}; } },
    "@/lib/email/smtp": { EmailDeliveryError: SyntheticDeliveryError, sendTransactionalEmail: async () => {
      sends++; if (scenario === "failed") throw new SyntheticDeliveryError("postmark_406");
      if (scenario === "unknown") throw new SyntheticDeliveryError("postmark_delivery_unknown");
      return { messageId: "synthetic" };
    } }, "./waitlist-email": { renderForumWaitlistEmail },
  }, { process: { env: { APP_URL: "https://example.invalid" } } });
  const run = exports.processForumWaitlistNotifications as () => Promise<Record<string, number>>;
  if (scenario === "config-failed") { await assert.rejects(run()); assert.equal(claims, 0); assert.equal(sends, 0); return; }
  if (scenario === "ack-failed") { await assert.rejects(run()); assert.equal(claims, 1); assert.equal(sends, 1); return; }
  const result = await run();
  const outcome = scenario === "expired" ? "failed" : scenario;
  assert.equal(result[outcome], 1);
  assert.equal(sends, scenario === "expired" ? 0 : 1);
  assert.equal(finishes[0].p_outcome, outcome);
  assert.equal(finishes[0].p_claim, "claim");
});

for (const intent of ["book", "cancel", "join", "leave", "accept"] as const) test(`participant action scopes ${intent} to the authenticated RPC`, async () => {
  const code = readFileSync("app/actions.ts", "utf8");
  const ast = ts.createSourceFile("actions.ts", code, ts.ScriptTarget.Latest, true);
  const node = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "setParticipantPanelBooking");
  assert.ok(node);
  const fn = ts.transpileModule(node.getText(ast).replace(/^export /, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  let rpcName = ""; let rpcArgs: Record<string, unknown> = {};
  const deps = {
    validForumChildIds,
    requirePublicPanelBookings: async () => {}, optionalText: (s: unknown) => typeof s === "string" ? s : null,
    createSupabaseServerClient: async () => ({ rpc: async (name: string, args: Record<string, unknown>) => { rpcName = name; rpcArgs = args; return { data: { status: intent === "accept" ? "booked" : intent === "join" ? "queued" : "left" }, error: null }; } }),
    getCurrentAuthContext: async () => ({ user: { id: "user" } }), revalidatePath: () => {},
    redirect: (path: string) => { throw new Error(path); },
  };
  const action = new Function(...Object.keys(deps), `${fn};return setParticipantPanelBooking;`)(...Object.values(deps));
  const form = new FormData(); form.set("registrationId", registrationId); form.set("panelId", panelId); form.set("sectionId", "section"); form.set("intent", intent);
  if (intent === "book" || intent === "join") form.append("childIds", panelId);
  await assert.rejects(action(form), /panelSaved=/);
  assert.equal(rpcName, "set_panel_family_booking");
  assert.equal(rpcArgs.p_registration_id, registrationId);
  assert.equal(rpcArgs.p_panel_id, panelId);
  assert.deepEqual(rpcArgs.p_child_ids, intent === "book" || intent === "join" ? [panelId] : []);
  assert.equal(rpcArgs.p_as_leader, false);
  assert.ok(!("actorUserId" in rpcArgs));
});

test("availability polling is five minutes, cannot overlap, and cleans up on leaving", async () => {
  let effect: (() => void) | undefined, intervalCallback: (() => void) | undefined, intervalMs = 0, cleaned = false, aborted = false;
  let reads = 0; let release: ((value: unknown) => void) | undefined;
  const exports = loadModule("lib/panels/use-forum-availability.ts", { react: {
    useState: (value: unknown) => [value, () => {}], useEffect: (fn: () => () => void) => { effect = fn; },
  } }, { window: { setInterval: (fn: () => void, ms: number) => { intervalCallback = fn; intervalMs = ms; return 1; }, clearInterval: () => { cleaned = true; } },
    fetch: (_url: string, options: { signal: AbortSignal }) => { reads++; options.signal.addEventListener("abort", () => { aborted = true; }); return new Promise(resolve => { release = resolve; }); } });
  (exports.useForumAvailability as (id: string, rows: object[]) => unknown)(registrationId, []);
  const cleanup = effect!() as unknown as () => void;
  assert.equal(intervalMs, 300_000); assert.equal(reads, 0);
  intervalCallback!(); intervalCallback!(); assert.equal(reads, 1);
  release!({ ok: true, json: async () => ({ rows: [] }) });
  await new Promise(resolve => setTimeout(resolve, 0));
  intervalCallback!(); assert.equal(reads, 2);
  cleanup(); assert.equal(cleaned, true); assert.equal(aborted, true);
});

for (const scenario of ["unauthenticated", "closed", "invalid", "database-failure", "owned"] as const) test(`availability endpoint handles ${scenario} without exposing other registrations`, async () => {
  let calls = 0;
  const db = { rpc: async (_name: string, args: Record<string, string>) => {
    calls++; assert.equal(args.p_registration_id, registrationId);
    return scenario === "database-failure" ? { error: { message: "secret" } } : { data: [{ panel_id: panelId }] };
  } };
  const exports = loadModule("app/dashboard/partecipante/forum-availability/route.ts", {
    "next/server": { NextResponse: { json: (data: unknown, options: ResponseInit = {}) => Response.json(data, options) } },
    "@/lib/supabase/server": { createSupabaseServerClient: async () => db },
    "@/lib/auth/session": { getCurrentAuthContext: async () => scenario === "unauthenticated" ? null : { user: { id: "synthetic" } } },
    "@/lib/panels/release": { getPanelReleaseMode: async () => scenario === "closed" ? "internal" : "open" },
  });
  const response = await (exports.GET as (request: Request) => Promise<Response>)(new Request(`http://127.0.0.1:3164/dashboard/partecipante/forum-availability?registrationId=${scenario === "invalid" ? "bad" : registrationId}`));
  assert.equal(response.status, ({ unauthenticated: 401, closed: 403, invalid: 400, "database-failure": 500, owned: 200 })[scenario]);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(calls, scenario === "owned" || scenario === "database-failure" ? 1 : 0);
  assert.doesNotMatch(await response.text(), /secret/);
});

test("cron authenticates before either worker and isolates their failures", async () => {
  let campaigns = 0, forums = 0, schools = 0, ceremonies = 0;
  const exports = loadModule("app/api/cron/email-campaigns/route.ts", {
    "@/lib/panels/school-qr-delivery": { processSchoolQrEmails: async () => { schools++; return {accepted:0}; } },
    "@/lib/ceremonies/publication-delivery.server": { processDueCeremonyPublications: async () => { ceremonies++; return {accepted:0}; } },
    "@/lib/supabase/service": { createSupabaseServiceClient: () => ({}) },
    "next/server": { NextResponse: { json: (data: unknown, options: ResponseInit = {}) => Response.json(data, options) } },
    "@/lib/email/campaign-delivery.server": { processDueCampaignDeliveries: async () => { campaigns++; return { sent: 0 }; } },
    "@/lib/panels/waitlist-delivery.server": { processForumWaitlistNotifications: async () => { forums++; throw new Error("synthetic failure with private details"); } },
  }, { process: { env: { CRON_SECRET: "synthetic-secret" } } });
  const get = exports.GET as (request: Request) => Promise<Response>;
  assert.equal((await get(new Request("http://127.0.0.1/api/cron/email-campaigns"))).status, 401);
  assert.equal(campaigns, 0); assert.equal(forums, 0); assert.equal(schools, 0); assert.equal(ceremonies, 0);
  const response = await get(new Request("http://127.0.0.1/api/cron/email-campaigns", { headers: { authorization: "Bearer synthetic-secret" } }));
  assert.equal(response.status, 500); assert.equal(campaigns, 1); assert.equal(forums, 1); assert.equal(schools, 1); assert.equal(ceremonies, 1);
  assert.doesNotMatch(await response.text(), /private details/);
});


test("Forum child selection accepts none, rejects duplicates, malformed values and oversized families", () => {
  assert.ok(validForumChildIds([]));
  assert.ok(validForumChildIds([panelId]));
  for (const value of [null, "[]", [panelId, panelId], ["bad"], [null], Array(11).fill(panelId)]) assert.equal(validForumChildIds(value), false);
});

test("participant cards allow offer acceptance and queue exit despite a same-slot booking", () => {
  const file = "app/dashboard/partecipante/participant-panel-bookings.tsx";
  const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const card = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "PanelBookingCard");
  assert.ok(card);
  const code = ts.transpileModule(card.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const deps = {
    exports: {}, require: () => ({ jsx, jsxs: jsx }), useState: () => [null, () => {}],
    FORUM_WAITLIST_COPY, getForumRelayRoom, FORUM_RELAY_COPY, formatSeatCount: () => "1 seat", formatDate: () => "date", formatTimeRange: () => "time",
    ForumLanguages: "languages", ForumChildSelection: "children", PendingSubmitButton: "submit", setParticipantPanelBooking: "action",
    CalendarDays: "calendar", Clock3: "clock", MapPin: "map", Users: "users", CheckCircle2: "check",
  };
  const render = new Function(...Object.keys(deps), `${code}; return PanelBookingCard;`)(...Object.values(deps));
  function submits(node: unknown): Record<string, unknown>[] {
    if (!node || typeof node !== "object") return [];
    if (Array.isArray(node)) return node.flatMap(submits);
    const element = node as { type?: unknown; props?: Record<string, unknown> };
    return [...(element.type === "submit" && element.props ? [element.props] : []), ...submits(element.props?.children)];
  }
  for (const [status, full, expectedDisabled, expectedLabel] of [
    ["offered", false, false, FORUM_WAITLIST_COPY.en.accept],
    ["queued", false, false, FORUM_WAITLIST_COPY.en.leave],
    ["selected", false, false, "Cancel"],
    ["conflict", false, true, "Book"],
    ["full", true, false, FORUM_WAITLIST_COPY.en.join],
  ] as const) {
    const tree = render({ locale: "en", registrationId, copy: { familySeats: () => "1 person", cancel: "Cancel", book: "Book" },
      row: { panel_id: panelId, section_id: "section", booking_status: status, has_slot_conflict: true, has_waiting: full,
        party_size: 1, remaining_seats: full ? 0 : 1, children: [], offer_expires_at: offer.expiresAt } });
    const [button] = submits(tree);
    assert.ok(button, status);
    assert.equal(button.disabled, expectedDisabled, status);
    assert.equal(button.children, expectedLabel, status);
  }
});
