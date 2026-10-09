import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { NextRequest, NextResponse } from "next/server.js";
import ts from "typescript";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadOperationsQr } from "../lib/registrations/operations-qr.server.ts";
import { encryptQrToken } from "../lib/qrcode/secure-token.ts";
import { renderQrDataUrl } from "../lib/qrcode/render.ts";

const id = "11111111-1111-4111-8111-111111111111";
function fixture(overrides: Record<string, Record<string, unknown>[]> = {}, fail = "") {
  const tables: Record<string, Record<string, unknown>[]> = {
    events: [{ id: "event", is_current: true }],
    registrations: [{ id, event_id: "event", deleted_at: null, participants: { first_name: "Anna", last_name: "Bianchi", public_code: "FIX1" } }],
    qr_tokens: [], ...overrides,
  };
  const reads: string[] = [];
  const db = { from(table: string) {
    reads.push(table);
    let rows = tables[table] ?? [];
    const q = {
      select() { return q; },
      eq(key: string, value: unknown) { rows = rows.filter(row => row[key] === value); return q; },
      is(key: string, value: unknown) { return q.eq(key, value); },
      order() { return q; }, limit(n: number) { rows = rows.slice(0, n); return q; },
      async maybeSingle() { return { data: rows[0] ?? null, error: table === fail ? new Error("synthetic") : null }; },
    }; return q;
  } } as unknown as SupabaseClient;
  return { db, reads };
}

test("QR scope rejects foreign, deleted, missing registrations and non-current events before token reads", async () => {
  const cases: Record<string, Record<string, unknown>[]>[] = [
    { registrations: [] },
    { registrations: [{ id, event_id: "other", deleted_at: null }] },
    { registrations: [{ id, event_id: "event", deleted_at: "deleted" }] },
    { events: [{ id: "event", is_current: false }] },
  ];
  for (const overrides of cases) {
    const { db, reads } = fixture(overrides);
    assert.equal(await loadOperationsQr(db, id, () => true), null);
    assert.ok(!reads.includes("qr_tokens"));
  }
  const { db, reads } = fixture();
  assert.equal(await loadOperationsQr(db, id, () => false), null);
  assert.deepEqual(reads, ["events"]);
});

test("operational QR renders only selected registration token and handles revoked/missing tokens", async (t) => {
  const previous = process.env.QR_TOKEN_ENCRYPTION_SECRET;
  process.env.QR_TOKEN_ENCRYPTION_SECRET = "synthetic-operations-qr-test-secret";
  t.after(() => { if (previous === undefined) delete process.env.QR_TOKEN_ENCRYPTION_SECRET; else process.env.QR_TOKEN_ENCRYPTION_SECRET = previous; });
  const token = "synthetic-selected-qr";
  const record = { registration_id: id, status: "active", expires_at: null, token_encrypted: encryptQrToken(token) };
  const { db } = fixture({ qr_tokens: [{ ...record, registration_id: "other" }, record] });
  const qr = await loadOperationsQr(db, id, event => event === "event");
  assert.equal(qr?.dataUrl, await renderQrDataUrl(token));
  assert.ok(qr?.downloadDataUrl?.startsWith("data:image/png;base64,"));
  assert.notEqual(qr?.dataUrl, qr?.downloadDataUrl);
  for (const status of ["revoked", "expired"]) {
    const result = await loadOperationsQr(fixture({ qr_tokens: [{ ...record, status }] }).db, id, () => true);
    assert.equal(result?.state, status);
    assert.equal(result?.dataUrl, null);
    assert.equal(result?.downloadDataUrl, null);
  }
  assert.equal((await loadOperationsQr(fixture().db, id, () => true))?.state, "unavailable");
});

test("operational QR fails closed on every database read error", async () => {
  for (const table of ["events", "registrations", "qr_tokens"]) {
    await assert.rejects(loadOperationsQr(fixture({}, table).db, id, () => true));
  }
});

test("real QR GET enforces auth, role, input, scope and private no-store responses", async () => {
  const source = ts.transpileModule(readFileSync(new URL("../app/dashboard/participants/qr/route.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [role, eventId, requestedId, status] of [
    [null, null, id, 401], ["manager_viewer", "event", id, 403], ["capogruppo", "event", id, 403],
    ["partecipante", "event", id, 403], ["manager", "other", id, 404],
    ["manager", "event", "invalid", 400], ["manager", "event", id, 200], ["admin", null, id, 200],
  ] as const) {
    const { db, reads } = fixture();
    const dependencies: Record<string, unknown> = {
      "next/server": { NextResponse },
      "@/lib/auth/session": { getCurrentAuthContext: async () => role ? { eventRoles: [{ role, eventId }] } : null },
      "@/lib/supabase/server": { createSupabaseServerClient: async () => ({}) },
      "@/lib/supabase/service": { createSupabaseServiceClient: () => db },
      "@/lib/registrations/operations-qr.server": { loadOperationsQr },
    };
    const exports: { GET?: (request: NextRequest) => Promise<NextResponse> } = {};
    new Function("require", "exports", source)((name: string) => { assert.ok(name in dependencies); return dependencies[name]; }, exports);
    const response = await exports.GET!(new NextRequest(`https://example.test/dashboard/participants/qr?registrationId=${requestedId}`));
    assert.equal(response.status, status, String(role));
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    if (status !== 200) assert.ok(!reads.includes("qr_tokens"));
  }
});
