import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server.js";
import * as persistence from "../lib/auth/session-persistence.ts";
import * as roles from "../lib/auth/roles.ts";
import * as duties from "../lib/reception/duties.server.ts";

function fixture(lastActivity: string) {
  const sessions = new Set(["this-device", "other-device"]);
  const jar = new Map([[persistence.LAST_ACTIVITY_COOKIE, lastActivity], [persistence.LAST_DASHBOARD_COOKIE, "/dashboard/admin"], ["iscrizioni_requested_role", "admin"]]);
  const scopes: string[] = [];
  const db = {
    rpc: async () => ({ data: false, error: null }),
    from: () => ({ select: () => ({ eq: async () => ({ data: [{ role: "admin" }], error: null }) }) }),
    auth: {
      getUser: async () => ({ data: { user: { id: "synthetic-user" } }, error: null }),
      signOut: async ({ scope = "global" } = {}) => {
        scopes.push(scope);
        if (scope === "global") sessions.clear();
        else if (scope === "local") sessions.delete("this-device");
        return { error: null };
      },
    },
  };
  const dependencies: Record<string, unknown> = {
    "next/server": { NextResponse },
    "next/headers": { cookies: async () => ({ get: (name: string) => jar.has(name) ? { value: jar.get(name) } : undefined, delete: (name: string) => jar.delete(name) }) },
    "next/navigation": { redirect: (url: string) => { throw Error(`redirect:${url}`); } },
    "@/lib/auth/session-persistence": persistence,
    "@/lib/auth/roles": roles,
    "@/lib/reception/duties.server": duties,
    "@/lib/supabase/server": { createSupabaseServerClient: async () => db },
    "@supabase/ssr": { createServerClient: () => db },
  };
  function load(path: string) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const exports: Record<string, (request: NextRequest) => Promise<NextResponse>> = {};
    new Function("require", "exports", js)((name: string) => {
      if (name in dependencies) return dependencies[name];
      // Unused server actions may import other modules, but must not execute them.
      return new Proxy({}, { get: () => { throw Error(`Unexpected dependency: ${name}`); } });
    }, exports);
    return exports;
  }
  const request = (path: string) => new NextRequest(`https://app.example.test${path}`, {
    method: "POST", headers: { cookie: [...jar].map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join("; "), "content-type": "application/json" },
    body: JSON.stringify({ path: "/dashboard/admin" }),
  });
  return { sessions, scopes, jar, load, request };
}

test("inactivity expires only the current device through both proxy and activity endpoint", async (t) => {
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, oldKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://auth.example.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "synthetic";
  t.after(() => {
    for (const [key, value] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL: oldUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: oldKey })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  for (const [path, method, url] of [["../proxy.ts", "proxy", "/dashboard/admin"], ["../app/api/auth/activity/route.ts", "POST", "/api/auth/activity"]]) {
    for (const activity of [String(Date.now() - persistence.SESSION_IDLE_TIMEOUT_MS), "invalid"]) {
      const h = fixture(activity);
      const response = await h.load(path)[method](h.request(url));
      assert.deepEqual(h.scopes, ["local"]);
      assert.deepEqual([...h.sessions], ["other-device"]);
      for (const cookie of [persistence.LAST_ACTIVITY_COOKIE, persistence.LAST_DASHBOARD_COOKIE]) assert.equal(response.cookies.get(cookie)?.maxAge, 0);
      if (method === "proxy") assert.equal(response.headers.get("location"), "https://app.example.test/login?error=inactive");
      else assert.equal(response.status, 401);
    }
    const active = fixture(String(Date.now()));
    const response = await active.load(path)[method](active.request(url));
    assert.deepEqual(active.scopes, []);
    assert.equal(active.sessions.size, 2);
    assert.ok(Number(response.cookies.get(persistence.LAST_ACTIVITY_COOKIE)?.value) > 0);
  }
});

test("explicit logout clears local app cookies and preserves the other device", async () => {
  const h = fixture(String(Date.now()));
  await assert.rejects(h.load("../app/actions.ts").logout(h.request("/")), /redirect:\//);
  assert.deepEqual(h.scopes, ["local"]);
  assert.deepEqual([...h.sessions], ["other-device"]);
  assert.equal(h.jar.size, 0);
});
