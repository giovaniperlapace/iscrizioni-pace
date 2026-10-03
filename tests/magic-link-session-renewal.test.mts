import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { NextRequest, NextResponse } from "next/server.js";
import ts from "typescript";
import * as roles from "../lib/auth/roles.ts";
import * as persistence from "../lib/auth/session-persistence.ts";
import * as confirmation from "../lib/auth/magic-link-confirmation.ts";
import * as locale from "../lib/i18n/config.ts";

type Handler = (request: NextRequest) => Promise<NextResponse>;
function load(path: string, dependencies: Record<string, unknown>) {
  const js = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: Record<string, Handler> = {};
  new Function("require", "exports", js)((name: string) => {
    assert.ok(name in dependencies, `Unexpected import: ${name}`);
    return dependencies[name];
  }, exports);
  return exports;
}

function harness(lastActivity: string | null, options: { existingUser?: boolean; failVerification?: boolean; role?: string } = {}) {
  const jar = new Map<string, string>();
  if (lastActivity !== null) jar.set(persistence.LAST_ACTIVITY_COOKIE, lastActivity);
  jar.set(persistence.LAST_DASHBOARD_COOKIE, "/dashboard/admin?section=iscritti");
  let user: { id: string } | null = options.existingUser ? { id: "synthetic" } : null;
  let verifications = 0, signouts = 0;
  const verify = async () => {
    verifications++;
    if (options.failVerification) return { error: new Error("Synthetic expired link") };
    user = { id: "synthetic" };
    jar.set("sb-synthetic-auth-token", "synthetic-new-session");
    return { error: null };
  };
  const db = {
    auth: {
      verifyOtp: verify,
      exchangeCodeForSession: verify,
      getUser: async () => ({ data: { user }, error: null }),
      signOut: async () => { signouts++; user = null; return { error: null }; },
    },
    from: () => ({ select: () => ({ eq: async () => ({ data: [{ role: options.role ?? "partecipante" }], error: null }) }) }),
  };
  const shared = {
    "next/server": { NextResponse },
    "@/lib/auth/roles": roles,
    "@/lib/auth/session-persistence": persistence,
    "@/lib/supabase/server": { createSupabaseServerClient: async () => db },
  };
  const callback = load("../app/auth/callback/route.ts", {
    ...shared,
    "@/lib/auth/magic-link-confirmation": confirmation,
    "@/lib/i18n/config": locale,
    "@/lib/auth/session": {
      ensureCurrentUserProfile: async () => {},
      getCurrentAuthContext: async () => ({ dashboardPath: `/dashboard/${options.role === "manager_viewer" ? "manager" : options.role ?? "partecipante"}` }),
    },
    "@/lib/supabase/service": { createSupabaseServiceClient: () => ({}) },
    "@/lib/registrations/public-flow": { linkParticipantsToUserByEmail: async () => {} },
  });
  const proxy = load("../proxy.ts", { ...shared, "@supabase/ssr": { createServerClient: () => db } }).proxy;
  const activity = load("../app/api/auth/activity/route.ts", {
    ...shared, "next/headers": { cookies: async () => ({ get: (name: string) => jar.has(name) ? { value: jar.get(name) } : undefined }) },
  }).POST;
  function request(path: string, body?: string) {
    return new NextRequest(`https://app.example.test${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        origin: "https://app.example.test",
        "content-type": "application/x-www-form-urlencoded",
        cookie: [...jar].map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join("; "),
      },
      ...(body === undefined ? {} : { body }),
    });
  }
  function accept(response: NextResponse) {
    for (const cookie of response.cookies.getAll()) {
      if (cookie.maxAge === 0) jar.delete(cookie.name);
      else jar.set(cookie.name, cookie.value);
    }
  }
  return { callback, proxy, activity, request, accept, jar, counts: () => ({ verifications, signouts }) };
}

// No real Auth, database or email calls: execute the actual handlers and proxy
// with Next's real request/response cookies and a synthetic authentication service.
test("first confirmed link survives stale browser state through dashboard and activity", async (t) => {
  const original = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://auth.example.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "synthetic";
  t.after(() => {
    for (const [key, value] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL: original.url, NEXT_PUBLIC_SUPABASE_ANON_KEY: original.key })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  for (const role of ["partecipante", "capogruppo", "manager", "manager_viewer", "admin", "accoglienza"]) {
    const dashboardPath = `/dashboard/${role === "manager_viewer" ? "manager" : role}`;
    for (const old of [String(Date.now() - 48 * 3600_000), "invalid", null]) {
      for (const params of ["token_hash=synthetic&type=email", "token=synthetic&type=magiclink", "code=synthetic"]) {
        const h = harness(old, { role });
        const login = await h.proxy(h.request("/login"));
        assert.equal(login.headers.get("location"), null);
        h.accept(login);
        const before = Date.now();
        const response = await h.callback.POST(h.request("/auth/callback", params));
        const renewed = response.cookies.get(persistence.LAST_ACTIVITY_COOKIE);
        assert.ok(renewed, "new login must replace the previous inactivity timestamp");
        assert.ok(Number(renewed.value) >= before && Number(renewed.value) <= Date.now());
        assert.equal(renewed.httpOnly, true);
        assert.equal(renewed.sameSite, "lax");
        assert.equal(renewed.path, "/");
        assert.equal(renewed.maxAge, persistence.SESSION_STATE_MAX_AGE_SECONDS);
        assert.equal(renewed.secure, process.env.NODE_ENV === "production");
        assert.equal(response.status, 303);
        h.accept(response);
        assert.equal(response.headers.get("location"), `https://app.example.test${dashboardPath}`);
        const dashboard = await h.proxy(h.request(dashboardPath));
        assert.equal(dashboard.headers.get("location"), null, "the first dashboard request must not expire the new session");
        h.accept(dashboard);
        const ping = await h.activity(h.request("/api/auth/activity", JSON.stringify({ path: dashboardPath })));
        assert.equal(ping.status, 204);
        assert.deepEqual(h.counts(), { verifications: 1, signouts: 0 });
      }
    }
  }
  const expired = harness(String(Date.now() - persistence.SESSION_IDLE_TIMEOUT_MS), { existingUser: true });
  const response = await expired.proxy(expired.request("/dashboard/partecipante"));
  assert.equal(response.headers.get("location"), "https://app.example.test/login?error=inactive");
  assert.equal(expired.counts().signouts, 1, "ordinary inactivity must still expire sessions");
});

test("scans, failed OTP/PKCE and invalid types never renew an existing session", async () => {
  for (const existingUser of [false, true]) {
    for (const params of ["token_hash=synthetic&type=email", "code=synthetic", "token_hash=synthetic&type=invalid"]) {
      const old = String(Date.now() - 48 * 3600_000);
      const h = harness(old, { existingUser, failVerification: true });
      const scanned = await h.callback.GET(h.request(`/auth/callback?${params}`));
      assert.equal(scanned.cookies.get(persistence.LAST_ACTIVITY_COOKIE), undefined);
      assert.equal(h.counts().verifications, 0);
      const response = await h.callback.POST(h.request("/auth/callback", params));
      assert.equal(response.cookies.get(persistence.LAST_ACTIVITY_COOKIE), undefined);
      h.accept(response);
      assert.equal(h.jar.get(persistence.LAST_ACTIVITY_COOKIE), old);
    }
  }
});
