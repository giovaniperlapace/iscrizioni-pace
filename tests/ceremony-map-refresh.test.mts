import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { parseSectorDirectoryQuery } from "../lib/ceremonies/sector-desk.ts";

const planId = "11111111-1111-4111-8111-000000000001";
const desk = { planId, revision: 12, drafts: [], allocations: [{ quantity: 28 }] };
function endpoint({ canManage = true, planExists = true, directoryRevision = 12, directoryError = false, deskError = false } = {}) {
  const calls: { name: string; input: unknown }[] = [];
  const filters: unknown[] = [];
  const plan = {
    select: () => plan,
    eq: (key: string, value: unknown) => { filters.push([key, value]); return plan; },
    maybeSingle: async () => ({ data: planExists ? { kind: "closing" } : null, error: null }),
  };
  const dependencies: Record<string, unknown> = {
    "next/server": { NextResponse: Response },
    "@/lib/supabase/server": { createSupabaseServerClient: async () => ({}) },
    "@/lib/ceremonies/service": { ceremonyContext: async () => ({ canManage, userId: "actor", event: { id: "event" } }) },
    "@/lib/ceremonies/sector-desk": { parseSectorDirectoryQuery },
    "@/lib/supabase/service": { createSupabaseServiceClient: () => ({
      from: () => plan,
      rpc: async (name: string, input: unknown) => {
        calls.push({ name, input });
        return name === "get_ceremony_draft_desk"
          ? { data: deskError ? null : desk, error: deskError }
          : { data: { revision: directoryRevision, people: [] }, error: directoryError };
      },
    }) },
  };
  const exports = {} as { GET: (request: { nextUrl: URL }) => Promise<Response> };
  const code = ts.transpileModule(readFileSync("app/dashboard/ceremonies/sectors/route.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "exports", code)((key: string) => {
    assert.ok(key in dependencies, key); return dependencies[key];
  }, exports);
  return { calls, filters, get: (suffix = "") => exports.GET({ nextUrl: new URL(`https://example.invalid/sectors?planId=${planId}${suffix}`) }) };
}

test("map refresh after publication reads the canonical desk even if the directory cannot load", async () => {
  const route = endpoint({ directoryError: true, directoryRevision: 11 });
  const response = await route.get("&view=map");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "loaded", desk, directory: null });
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.deepEqual(route.calls, [{ name: "get_ceremony_draft_desk", input: { p_event: "event", p_actor: "actor", p_kind: "closing" } }]);
  assert.deepEqual(route.filters, [["id", planId], ["event_id", "event"]]);
});

test("map refresh retains manager/event scope and distinguishes a failed desk read", async () => {
  for (const config of [{ canManage: false }, { planExists: false }]) {
    const route = endpoint(config);
    assert.equal((await route.get("&view=map")).status, 403);
    assert.deepEqual(route.calls, []);
  }
  assert.equal((await endpoint({ deskError: true }).get("&view=map")).status, 503);
});

test("assignment directory still rejects mixed revisions and unavailable data", async () => {
  for (const config of [{ directoryRevision: 11 }, { directoryError: true }, { deskError: true }]) {
    assert.equal((await endpoint(config).get()).status, 503);
  }
  const response = await endpoint().get();
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).directory, { revision: 12, people: [] });
});
