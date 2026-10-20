import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { readFileSync } from "node:fs";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
test("bulk route validates origin/selection, uses session actor, revalidates only successful atomic calls", async () => {
  const compiled = ts.transpileModule(readFileSync("app/dashboard/participants/bulk-update/route.ts", "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const calls: { name: string; args: Record<string, unknown> }[] = [], paths: string[] = [];
  let auth: unknown = { user: { id: "trusted-actor" } }, failure = false;
  const dependencies: Record<string, unknown> = {
    "next/server": { NextResponse: Response }, "next/cache": { revalidatePath: (path: string) => paths.push(path) },
    "@/lib/auth/session": { getCurrentAuthContext: async () => auth },
    "@/lib/supabase/server": { createSupabaseServerClient: async () => ({}) },
    "@/lib/supabase/service": { createSupabaseServiceClient: () => ({ rpc: async (name: string, args: Record<string, unknown>) => { calls.push({ name, args }); return { data: 2, error: failure ? { code: "42501" } : null }; } }) },
  };
  const exported: { POST?: (request: unknown) => Promise<Response> } = {};
  new Function("require", "exports", compiled)((name: string) => { assert.ok(name in dependencies); return dependencies[name]; }, exported);
  const body = { eventId: id(1), registrationIds: [id(2), id(3)], field: "tags", value: id(4), actorId: "forged", dashboard: "manager" };
  const call = (payload: unknown = body, origin = "https://app.test") => exported.POST!({ headers: new Headers({ origin }), nextUrl: new URL("https://app.test/dashboard/participants/bulk-update"), json: async () => payload });
  assert.equal((await call(body, "https://foreign.test")).status, 403);
  for (const payload of [null, {}, { ...body, registrationIds: [] }, { ...body, registrationIds: [id(2), id(2)] }, { ...body, registrationIds: Array.from({ length: 101 }, (_, i) => id(i)) }, { ...body, field: "identity" }]) assert.equal((await call(payload)).status, 422);
  auth = null; assert.equal((await call()).status, 401); assert.equal(calls.length, 0);
  auth = { user: { id: "trusted-actor" } };
  assert.equal((await call()).status, 200); assert.equal(calls[0].args.p_actor_user_id, "trusted-actor"); assert.equal(paths.length, 4);
  failure = true; assert.equal((await call()).status, 422); assert.equal(paths.length, 4);
  failure = false; assert.equal((await call({ ...body, field: "delete-tag" })).status, 200); assert.equal(calls.at(-1)?.name, "delete_operational_tag");
});
