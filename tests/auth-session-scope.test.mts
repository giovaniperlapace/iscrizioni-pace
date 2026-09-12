import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import * as roles from "../lib/auth/roles.ts";
import * as persistence from "../lib/auth/session-persistence.ts";

function loadModule<T>(path: string, dependencies: Record<string, unknown>) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: Record<string, unknown> = {};
  new Function("require", "exports", js)((name: string) => {
    if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
    return dependencies[name];
  }, exports);
  return exports as T;
}

function database(ownRole: string | null) {
  const rows = {
    event_user_roles: [
      ...Array.from({ length: 1000 }, (_, i) => ({ user_id: `other-${i}`, role: "manager", event_id: "event" })),
      { user_id: "another-admin", role: "admin", event_id: null },
      ...(ownRole ? [{ user_id: "current", role: ownRole, event_id: ownRole === "admin" ? null : "event" }] : []),
    ],
    group_memberships: [{ user_id: "other-leader", role: "capogruppo", groups: { event_id: "event" } }],
  };
  return {
    auth: { getUser: async () => ({ data: { user: { id: "current" } }, error: null }) },
    from(table: keyof typeof rows) {
      let selected: Record<string, unknown>[] = rows[table];
      return {
        select() { return this; },
        eq(field: string, value: string) { selected = selected.filter((row) => row[field] === value); return this; },
        then(resolve: (value: unknown) => unknown) { return Promise.resolve({ data: selected.slice(0, 1000), error: null }).then(resolve); },
      };
    },
  };
}

const session = loadModule<{ getCurrentAuthContext: (db: ReturnType<typeof database>) => Promise<{ eventRoles: unknown[]; dashboardPath: string }> }>("../lib/auth/session.ts", { "./roles": roles });
for (const ownRole of ["admin", "manager", null]) {
  test(`session resolves only the authenticated account's roles: ${ownRole}`, async () => {
    const result = await session.getCurrentAuthContext(database(ownRole));
    assert.deepEqual(result.eventRoles, ownRole ? [{ role: ownRole, eventId: ownRole === "admin" ? null : "event" }] : []);
    assert.equal(result.dashboardPath, `/dashboard/${ownRole ?? "partecipante"}`);
  });

  test(`proxy uses own roles despite other visible assignments and row limits: ${ownRole}`, async () => {
    const response = (url?: URL) => ({ url: url?.pathname, cookies: { getAll: () => [], set() {} } });
    const proxy = loadModule<{ proxy: (request: unknown) => Promise<{ url?: string }> }>("../proxy.ts", {
      "@supabase/ssr": { createServerClient: () => database(ownRole) },
      "next/server": { NextResponse: { next: () => response(), redirect: (url: URL) => response(url) } },
      "@/lib/auth/roles": roles,
      "@/lib/auth/session-persistence": persistence,
    });
    const previous = [process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY];
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.test";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test";
    try {
      const result = await proxy.proxy({ url: "https://example.test/dashboard/admin", nextUrl: new URL("https://example.test/dashboard/admin"), cookies: { getAll: () => [], get: () => undefined } });
      assert.equal(result.url, ownRole === "admin" ? undefined : `/dashboard/${ownRole ?? "partecipante"}`);
    } finally {
      for (const [index, key] of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"].entries()) {
        if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index];
      }
    }
  });
}
