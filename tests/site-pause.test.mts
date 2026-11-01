import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { setImmediate } from "node:timers/promises";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server.js";
import testing from "next/experimental/testing/server.js";
const { unstable_doesMiddlewareMatch } = testing;
import { canAccessPausedSite } from "../lib/site-pause.ts";
import { hasPausedSiteAccess, hasPausedSiteEmailAccess } from "../lib/auth/paused-access.ts";
import { EventAttendanceStore, ATTENDANCE_RECONCILE_MS } from "../lib/reception/attendance-store.ts";
import { getStaffLoginPath, isStaffLoginPath } from "../lib/auth/staff-login.ts";
import * as roles from "../lib/auth/roles.ts";
import * as persistence from "../lib/auth/session-persistence.ts";

function load(path: string, deps: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Runtime exports of isolated source fixtures.
  const exports: Record<string, any> = {};
  new Function("require", "exports", ...Object.keys(extra), code)((name: string) => {
    if (name.includes("site-pause")) return { isSitePaused: () => true };
    if (name in deps) return deps[name];
    if (name.includes("staff-login")) return { isStaffLoginPath: () => false, getStaffLoginPath: () => "/login/synthetic" };
    return new Proxy({}, { get: () => { throw Error(`Unexpected side effect: ${name}`); } });
  }, exports, ...Object.values(extra));
  return exports;
}
function database(role: string, eventId: string | null = "current", failure = "") {
  const reads: string[] = [];
  return {
    reads,
    auth: { getUser: async () => ({ data: { user: { id: "own" } }, error: null }) },
    rpc: async () => ({ data: false, error: null }),
    from(table: string) {
      reads.push(table);
      const rows = table === "event_user_roles" ? [{ role, event_id: eventId }] : table === "profiles" ? [{ id: "own" }] : [];
      return {
        select() { return this; }, eq(field: string, value: unknown) { if (field === "user_id") assert.equal(value, "own"); return this; },
        limit() { return this; },
        maybeSingle: async () => ({ data: { id: "current" }, error: failure === table ? {} : null }),
        then(resolve: (x: unknown) => unknown) { return Promise.resolve({ data: rows, error: failure === table ? {} : null }).then(resolve); },
      };
    },
  };
}

test("pause allows only global admins and current-event managers, never metadata or other roles", () => {
  for (const role of ["partecipante", "capogruppo", "accoglienza", "manager_viewer", "docente", null]) {
    assert.equal(canAccessPausedSite([{ role, event_id: "current" }], "current"), false);
  }
  assert.equal(canAccessPausedSite([{ role: "manager", event_id: "current" }], "current"), true);
  assert.equal(canAccessPausedSite([{ role: "manager", event_id: "other" }], "current"), false);
  assert.equal(canAccessPausedSite([{ role: "manager", event_id: null }], "current"), false);
  assert.equal(canAccessPausedSite([{ role: "admin", event_id: "current" }], "current"), false);
  assert.equal(canAccessPausedSite([{ role: "admin", event_id: null }], null), true);
});

test("canonical pause access fails closed on roles, event and email read failures", async () => {
  for (const [role, event, failure, expected] of [
    ["admin", null, "", true], ["manager", "current", "", true], ["manager", "other", "", false],
    ["manager", "current", "events", false], ["admin", null, "event_user_roles", false],
    ["capogruppo", "current", "", false],
  ] as const) {
    const db = database(role, event, failure);
    assert.equal(await hasPausedSiteAccess(db as never, "own"), expected);
    if (role === "admin" && !failure) assert.deepEqual(db.reads, ["event_user_roles"]);
  }
  assert.equal(await hasPausedSiteEmailAccess(database("manager", "current", "profiles") as never, "example@example.invalid"), false);
});

test("static home, assets and cron bypass middleware; all app entry points remain gated", () => {
  const { config } = load("proxy.ts", {});
  for (const url of ["/", "/?forum=old", "/paused/home.js", "/logos/logo_santegidio.png", "/_next/static/chunk.js", "/api/cron/email-campaigns", "/api/webhooks/postmark"]) {
    assert.equal(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url }), false, url);
  }
  for (const url of ["/login", "/auth/callback", "/dashboard/partecipante", "/api/forum-reception", "/registrazione", "/scuole/accesso", "/gruppo_test"]) {
    assert.equal(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url }), true, url);
  }
});

test("existing sessions are refused on pages and APIs while admin and manager access survives", async t => {
  const old = [process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY];
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.invalid"; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "synthetic";
  t.after(() => { for (const [i, key] of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"].entries()) { if (old[i] === undefined) delete process.env[key]; else process.env[key] = old[i]; } });
  for (const role of ["partecipante", "capogruppo", "manager_viewer", "manager", "admin"]) {
    const db = database(role, role === "admin" ? null : "current");
    const { proxy } = load("proxy.ts", {
      "@supabase/ssr": { createServerClient: () => db }, "next/server": { NextResponse },
      "@/lib/auth/paused-access": { hasPausedSiteAccess }, "@/lib/auth/roles": roles,
      "@/lib/auth/session-persistence": persistence, "@/lib/reception/duties.server": { hasPanelReceptionDuty: async () => false },
    });
    const privileged = role === "admin" || role === "manager";
    const response = await proxy(new NextRequest("https://site.invalid/dashboard", { headers: { cookie: "sb-synthetic-auth-token=old" } }));
    assert.equal(new URL(response.headers.get("location")).pathname, privileged ? `/dashboard/${role}` : "/");
    const api = await proxy(new NextRequest("https://site.invalid/api/forum-reception"));
    assert.equal(api.status, privileged ? 200 : 403);
    if (!privileged) assert.equal(response.cookies.get("sb-synthetic-auth-token")?.maxAge, 0);
  }
});

test("closed public registration and school actions stop before parsing or side effects", async () => {
  const { submitPublicRegistration, submitPublicSchoolBooking, requestSchoolBookingAccess } = load("app/actions.ts", {
    "next/navigation": { redirect: (path: string) => { throw Error(`redirect:${path}`); } },
  });
  for (const action of [submitPublicRegistration, submitPublicSchoolBooking, requestSchoolBookingAccess]) {
    await assert.rejects(action(new FormData()), /^Error: redirect:\/$/);
  }
});

test("cron fallback does not initialize a database client or run any workers", async () => {
  const { GET } = load("app/api/cron/email-campaigns/route.ts", { "next/server": { NextResponse } });
  const response = await GET(new Request("https://site.invalid/api/cron/email-campaigns"));
  assert.deepEqual(await response.json(), { paused: true });
});

test("both availability hooks install no timer or network request during pause", () => {
  for (const [path, name, args] of [
    ["lib/panels/use-forum-availability.ts", "useForumAvailability", ["registration", []]],
    ["lib/panels/use-group-forum-availability.ts", "useGroupForumAvailability", [{}, null, false]],
  ] as const) {
    let effect: () => unknown = () => {};
    const loaded = load(path, { react: { useState: (value: unknown) => [value, () => {}], useEffect: (fn: () => unknown) => { effect = fn; } } }, {
      window: new Proxy({}, { get: () => { throw Error("Timer installed during pause"); } }), fetch: () => { throw Error("Unexpected read"); },
    });
    loaded[name](...args); assert.equal(effect(), undefined);
  }
});

test("attendance remains readable on demand without periodic or focus reconciliation", async t => {
  const old = process.env.NEXT_PUBLIC_SITE_PAUSED; process.env.NEXT_PUBLIC_SITE_PAUSED = "true";
  t.after(() => { if (old === undefined) delete process.env.NEXT_PUBLIC_SITE_PAUSED; else process.env.NEXT_PUBLIC_SITE_PAUSED = old; });
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.now() });
  const win = new EventTarget(), doc = Object.assign(new EventTarget(), { hidden: false });
  const cleanup: Array<() => void> = [];
  for (const [name, value] of Object.entries({ window: win, document: doc, BroadcastChannel: undefined })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    cleanup.push(() => { if (previous) Object.defineProperty(globalThis, name, previous); else Reflect.deleteProperty(globalThis, name); });
  }
  const fetcher = t.mock.method(globalThis, "fetch", async () => Response.json({ eventId: "current", updatedAt: new Date().toISOString(), entries: {}, schoolEntries: {}, totals: {} }));
  const store = new EventAttendanceStore("current"); const stop = store.start(); t.after(() => { stop(); cleanup.forEach(reset => reset()); });
  await setImmediate(); assert.equal(fetcher.mock.callCount(), 1);
  t.mock.timers.tick(ATTENDANCE_RECONCILE_MS * 100); win.dispatchEvent(new Event("focus")); await setImmediate();
  assert.equal(fetcher.mock.callCount(), 1);
  store.refresh(); await setImmediate(); assert.equal(fetcher.mock.callCount(), 2);
});

test("suspended or unknown emails receive a neutral result without sending a magic link", async () => {
  let sends = 0;
  const { startPublicEmailFlow } = load("app/actions.ts", {
    "@/lib/auth/paused-access": { hasPausedSiteEmailAccess: async () => false },
    "@/lib/registrations/validation": { normalizeEmail: () => "person@example.invalid" },
    "@/lib/panels/booking-intent": { parseForumIntent: () => null },
    "@/lib/supabase/service": { createSupabaseServiceClient: () => ({}) },
    "@/lib/security/rate-limit": { checkRateLimit: () => true },
    "next/headers": { headers: async () => new Headers() },
    "next/navigation": { redirect: (path: string) => { throw Error(path); } },
    "@/lib/registrations/public-flow": { sendMagicLinkEmail: async () => { sends++; } },
  });
  const previous = process.env.APP_URL; process.env.APP_URL = "https://site.invalid";
  try {
    await assert.rejects(startPublicEmailFlow(new FormData()), /\/login\/synthetic\?sent=magic-link/);
    assert.equal(sends, 0);
  } finally { if (previous === undefined) delete process.env.APP_URL; else process.env.APP_URL = previous; }
});

test("an old magic link cannot link profiles or open a suspended account", async () => {
  const scopes: string[] = [];
  const { POST } = load("app/auth/callback/route.ts", {
    "next/server": { NextResponse },
    "@/lib/auth/paused-access": { hasPausedSiteAccess: async () => false },
    "@/lib/auth/magic-link-confirmation": { MAGIC_LINK_RESPONSE_HEADERS: { "Cache-Control": "private, no-store" } },
    "@/lib/supabase/server": { createSupabaseServerClient: async () => ({ auth: {
      verifyOtp: async () => ({ error: null }), getUser: async () => ({ data: { user: { id: "old-user" } } }),
      signOut: async ({ scope }: { scope: string }) => { scopes.push(scope); },
    } }) },
  });
  const response = await POST(new NextRequest("https://site.invalid/auth/callback", {
    method: "POST", headers: { origin: "https://site.invalid", "content-type": "application/x-www-form-urlencoded" },
    body: "token_hash=synthetic&type=magiclink",
  }));
  assert.equal(response.headers.get("location"), "https://site.invalid/");
  assert.deepEqual(scopes, ["local"]);
});

test("private login requires the exact server-only random suffix and never exposes it via redirects", async t => {
  const old = process.env.STAFF_LOGIN_TOKEN;
  const token = "ab".repeat(24); process.env.STAFF_LOGIN_TOKEN = token;
  t.after(() => { if (old === undefined) delete process.env.STAFF_LOGIN_TOKEN; else process.env.STAFF_LOGIN_TOKEN = old; });
  assert.equal(getStaffLoginPath(), `/login/${token}`);
  for (const path of ["/login", "/login/guess", `/login/${token}extra`, `/login/${token.toUpperCase()}`]) assert.equal(isStaffLoginPath(path), false);
  const { proxy } = load("proxy.ts", { "@/lib/auth/staff-login": { isStaffLoginPath }, "next/server": { NextResponse } });
  for (const path of ["/login", "/login/guess"]) {
    const response = await proxy(new NextRequest(`https://site.invalid${path}`));
    assert.equal(response.headers.get("location"), "https://site.invalid/");
    assert.ok(!response.headers.get("location")?.includes(token));
  }
  delete process.env.STAFF_LOGIN_TOKEN;
  assert.equal(getStaffLoginPath(), null);
  assert.equal(isStaffLoginPath(`/login/${token}`), false);
  process.env.STAFF_LOGIN_TOKEN = "too-short"; assert.equal(getStaffLoginPath(), null);
  const html = readFileSync("public/paused/index.html", "utf8");
  assert.doesNotMatch(html, /\/login|Accesso riservato/);
});
