import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { closingBadgeSector } from "../lib/ceremonies/closing-badges.ts";
const id = "00000000-0000-4000-8000-000000000001";
function route({ signedIn = true, error = null, data = { name: "Nome corrente", badgeCode: "CLOSING_PURPLE" } }: { signedIn?: boolean; error?: { code: string } | null; data?: unknown } = {}) {
  const calls: unknown[] = [];
  const dependencies: Record<string, unknown> = {
    "@/lib/supabase/server": { createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: signedIn ? { id } : null }, error: null }) } }) },
    "@/lib/supabase/service": { createSupabaseServiceClient: () => ({ rpc: async (name: string, input: unknown) => { calls.push({ name, input }); return { data, error }; } }) },
    "@/lib/email/campaign-badge.server": { createCampaignBadge: async (identity: unknown, template: unknown) => { calls.push({ identity, template }); return {
      pdf: { filename: "badge.pdf", content: Buffer.from("%PDF-synthetic"), contentType: "application/pdf" },
      image: { filename: "badge.jpg", content: Buffer.from("JPEG-synthetic"), contentType: "image/jpeg" },
    }; } },
    "@/lib/ceremonies/closing-badges": { closingBadgeSector },
  };
  const exports = {} as { GET: (req: Request) => Promise<Response> };
  const code = ts.transpileModule(readFileSync("app/dashboard/ceremonies/badge/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "exports", code)((key: string) => { assert.ok(key in dependencies, key); return dependencies[key]; }, exports);
  return { ...exports, calls };
}
test("badge endpoint uses authenticated actor and canonical name, returns private PDF attachment", async () => {
  const { GET, calls } = route();
  const result = await GET(new Request(`https://example.invalid/dashboard/ceremonies/badge?nominee=${id}&actor=spoof&name=spoof`));
  assert.equal(result.status, 200); assert.equal(result.headers.get("Content-Type"), "application/pdf");
  assert.match(result.headers.get("Content-Disposition")!, /^attachment;/); assert.match(result.headers.get("Cache-Control")!, /private, no-store/);
  assert.match(await result.text(), /^%PDF/);
  assert.deepEqual(calls[0], { name: "get_closing_ceremony_badge", input: { p_actor: id, p_nominee: id } });
  assert.deepEqual(calls[1], { identity: { firstName: "Nome corrente", lastName: "", groupName: "" }, template: "piazza-inferiore-viola-v1" });
});
test("badge endpoint distinguishes invalid request, missing auth, scope rejection, revoked badge and technical failure", async () => {
  for (const [config, expected] of [[{ signedIn: false }, 401], [{ error: { code: "42501" } }, 403], [{ data: null }, 404], [{ error: { code: "08006" } }, 503]] as const) {
    assert.equal((await route(config).GET(new Request(`https://example.invalid/badge?nominee=${id}`))).status, expected);
  }
  const invalid = route(); assert.equal((await invalid.GET(new Request("https://example.invalid/badge?nominee=bad"))).status, 400); assert.equal(invalid.calls.length, 0);
  const jpg = await route().GET(new Request(`https://example.invalid/badge?nominee=${id}&format=jpg`));
  assert.equal(jpg.headers.get("Content-Type"), "image/jpeg"); assert.match(jpg.headers.get("Content-Disposition")!, /^inline;/);
});
