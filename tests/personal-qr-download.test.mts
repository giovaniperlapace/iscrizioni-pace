import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";
import { loadRegistrationQr, registrationQrState } from "../lib/qrcode/registration-qr.ts";
import { encryptQrToken, decryptQrToken } from "../lib/qrcode/secure-token.ts";
import { renderParticipantQrPng } from "../lib/qrcode/participant-card.ts";
import { participantQrFilename } from "../lib/qrcode/filename.ts";

const source = ts.transpileModule(readFileSync(new URL("../app/dashboard/partecipante/qr/download/route.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const identity = { auth_user_id: "self", first_name: "Éléonore", last_name: "Ковальчук", public_code: "TEST" };
const own = { id: "own", submitted_at: "2026-10-12", deleted_at: null, events: { is_current: true }, participants: identity };
const token = "synthetic-personal-qr-download";

function setup(options: { authenticated?: boolean; role?: string; rows?: unknown[]; records?: unknown[]; fail?: string } = {}) {
  const requests: URL[] = [];
  let serviceCalls = 0;
  const rows = options.rows ?? [own];
  const db = createClient("https://example.test", "synthetic", { global: { fetch: async (input, init) => {
    const url = new URL(String(input));
    requests.push(url);
    assert.equal(init?.method, "GET", "QR downloads must only read the database");
    const table = url.pathname.split("/").at(-1);
    if (table === options.fail) return new Response(JSON.stringify({ message: "synthetic failure" }), { status: 500 });
    if (table === "registrations") {
      assert.equal(url.searchParams.get("participants.auth_user_id"), "eq.self");
      assert.equal(url.searchParams.get("events.is_current"), "eq.true");
      assert.equal(url.searchParams.get("deleted_at"), "is.null");
      assert.equal(url.searchParams.get("order"), "submitted_at.desc,id.desc");
      assert.equal(url.searchParams.get("limit"), "1");
      assert.match(url.searchParams.get("select")!, /participants!inner/);
      // Use the real Supabase query builder, including its maybeSingle handling.
      const filtered = (rows as typeof own[]).filter(row => row.deleted_at === null && row.events.is_current
        && (Array.isArray(row.participants) ? row.participants[0] : row.participants).auth_user_id === "self")
        .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at) || b.id.localeCompare(a.id));
      return Response.json(filtered.slice(0, 1));
    }
    assert.equal(table, "qr_tokens");
    assert.equal(url.searchParams.get("registration_id"), "eq.own");
    assert.equal(url.searchParams.get("order"), "created_at.desc,id.desc");
    assert.equal(url.searchParams.get("limit"), "1");
    return Response.json((options.records ?? [{ status: "active", expires_at: null, token_encrypted: encryptQrToken(token) }]).slice(0, 1));
  } } });
  const dependencies: Record<string, unknown> = {
    "@/lib/auth/session": { getCurrentAuthContext: async (_db: unknown, role: string) => {
      assert.equal(role, "partecipante");
      return options.authenticated === false ? null : { user: { id: "self" }, eventRoles: [{ role: options.role ?? "partecipante" }] };
    } },
    "@/lib/supabase/server": { createSupabaseServerClient: async () => db },
    "@/lib/supabase/service": { createSupabaseServiceClient: () => { serviceCalls++; return db; } },
    "@/lib/qrcode/registration-qr": { loadRegistrationQr, registrationQrState },
    "@/lib/qrcode/secure-token": { decryptQrToken },
    "@/lib/qrcode/participant-card": { renderParticipantQrPng },
    "@/lib/qrcode/filename": { participantQrFilename },
  };
  const exports: { GET?: (request?: Request) => Promise<Response> } = {};
  new Function("require", "exports", source)((name: string) => { assert.ok(name in dependencies); return dependencies[name]; }, exports);
  return { GET: exports.GET!, requests, serviceCalls: () => serviceCalls };
}

function privateResponse(response: Response) {
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
  assert.equal(response.headers.get("vary"), "Cookie");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
}

test("personal QR download is a named PNG attachment containing the exact existing QR", async (t) => {
  const previous = process.env.QR_TOKEN_ENCRYPTION_SECRET;
  process.env.QR_TOKEN_ENCRYPTION_SECRET = "synthetic-personal-download-secret";
  t.after(() => { if (previous === undefined) delete process.env.QR_TOKEN_ENCRYPTION_SECRET; else process.env.QR_TOKEN_ENCRYPTION_SECRET = previous; });
  const fixture = setup();
  // URL-supplied identities are deliberately ignored.
  const response = await fixture.GET(new Request("https://example.test/dashboard/partecipante/qr/download?registrationId=foreign&filename=wrong.png"));
  assert.equal(response.status, 200);
  privateResponse(response);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal(response.headers.get("content-disposition"), `attachment; filename="qr-partecipante.png"; filename*=UTF-8''${encodeURIComponent(participantQrFilename(`${identity.first_name} ${identity.last_name}`))}`);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), await renderParticipantQrPng(token, identity));
  assert.equal(fixture.serviceCalls(), 1);
});

test("anonymous, missing, deleted and foreign registrations never read QR credentials", async () => {
  for (const options of [
    { authenticated: false }, { rows: [] },
    { rows: [{ ...own, deleted_at: "2026-10-12" }] },
    { rows: [{ ...own, events: { is_current: false } }] },
    { rows: [{ ...own, participants: { ...identity, auth_user_id: "foreign" } }] },
  ]) {
    const fixture = setup(options);
    const response = await fixture.GET();
    assert.equal(response.status, options.authenticated === false ? 401 : 404);
    privateResponse(response);
    assert.equal(fixture.serviceCalls(), 0);
    assert.ok(!fixture.requests.some(url => url.pathname.endsWith("qr_tokens")));
    assert.equal((await response.arrayBuffer()).byteLength, 0);
  }
});

test("additional roles and more than 1,000 foreign registrations cannot change the personal QR", async (t) => {
  const previous = process.env.QR_TOKEN_ENCRYPTION_SECRET;
  process.env.QR_TOKEN_ENCRYPTION_SECRET = "synthetic-personal-download-secret";
  t.after(() => { if (previous === undefined) delete process.env.QR_TOKEN_ENCRYPTION_SECRET; else process.env.QR_TOKEN_ENCRYPTION_SECRET = previous; });
  const rows = [
    ...Array.from({ length: 1100 }, (_, index) => ({ ...own, id: `foreign-${index}`, submitted_at: "2026-10-13", participants: { ...identity, auth_user_id: `foreign-${index}` } })),
    { ...own, id: "own-old", submitted_at: "2026-09-01" }, own,
    { ...own, id: "deleted", submitted_at: "2026-10-14", deleted_at: "2026-10-14" },
  ];
  for (const role of ["admin", "manager", "manager_viewer", "capogruppo", "partecipante"]) {
    const response = await setup({ rows, role }).GET();
    assert.equal(response.status, 200, role);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), await renderParticipantQrPng(token, identity));
  }
  assert.equal((await setup({ rows: [{ ...own, participants: [identity] }] }).GET()).status, 200);
});

test("newest revoked, expired, missing or undecipherable QR never falls back to an older token", async () => {
  for (const records of [
    [], [{ status: "revoked" }, { status: "active" }],
    [{ status: "active", revoked_at: "2026-10-12" }],
    [{ status: "expired" }], [{ status: "active", expires_at: "2020-01-01" }],
    [{ status: "active", expires_at: "invalid" }],
    [{ status: "active", token_encrypted: null }],
    [{ status: "active", token_encrypted: "invalid" }],
  ]) {
    const response = await setup({ records }).GET();
    assert.equal(response.status, 404);
    privateResponse(response);
    assert.equal(response.headers.get("content-disposition"), null);
    assert.equal((await response.arrayBuffer()).byteLength, 0);
  }
});

test("database failures return a private error instead of an image or partial download", async () => {
  for (const table of ["registrations", "qr_tokens"]) {
    const fixture = setup({ fail: table });
    const response = await fixture.GET();
    assert.equal(response.status, 500);
    privateResponse(response);
    assert.equal(response.headers.get("content-type"), null);
    assert.equal((await response.arrayBuffer()).byteLength, 0);
    if (table === "registrations") assert.equal(fixture.serviceCalls(), 0);
  }
});

test("the real personal download button points to an HTTP file rather than a data URL", () => {
  const page = readFileSync(new URL("../app/dashboard/partecipante/page.tsx", import.meta.url), "utf8");
  const start = page.indexOf("function QrActionButtons(");
  const end = page.indexOf("function RegistrationSummaryCard(", start);
  const output = ts.transpileModule(page.slice(start, end), { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS } }).outputText;
  const elements: { type: unknown; props: Record<string, unknown> }[] = [];
  const React = { createElement: (type: unknown, props: Record<string, unknown>, ...children: unknown[]) => {
    const node = { type, props: props ?? {}, children }; elements.push(node); return node;
  } };
  const render = new Function("React", "participantQrFilename", "DownloadIcon", `${output}; return QrActionButtons;`)(React, participantQrFilename, () => null);
  render({ participantName: "Anna Prova", qrDataUrl: "data:image/png;base64,synthetic", copy: { downloadImage: "Scarica immagine" } });
  const link = elements.find(node => node.type === "a")!;
  assert.equal(link.props.href, "/dashboard/partecipante/qr/download");
  assert.equal(link.props.download, "qr-Anna-Prova.png");
  elements.length = 0;
  render({ participantName: "Anna Prova", qrDataUrl: null, copy: { downloadImage: "Scarica immagine" } });
  assert.ok(!elements.some(node => node.type === "a"));
  assert.ok(elements.some(node => node.type === "button" && node.props.disabled));
});
