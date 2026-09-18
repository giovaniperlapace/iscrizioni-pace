import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";
import * as loaders from "../lib/supabase/all-rows.ts";
import { getOperationalUserIdentities } from "../lib/operational-users/identity.ts";
import { findAuthUserByEmail } from "../lib/operational-users/auth-user.server.ts";

function fn(file: string, name: string, deps: Record<string, unknown>) {
  const source = readFileSync(file, "utf8"), ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  let found: ts.FunctionDeclaration | undefined;
  function visit(n: ts.Node) { if (ts.isFunctionDeclaration(n) && n.name?.text === name) found = n; ts.forEachChild(n, visit); }
  visit(ast); assert.ok(found);
  const js = ts.transpileModule(found.getText(ast).replace(/^export /, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(deps), `${js}; return ${name}`)(...Object.values(deps));
}

type Row = Record<string, unknown>;
function database(tables: Record<string, Row[]>, fail?: (url: URL, method: string) => boolean) {
  const calls: { url: URL; method: string }[] = [];
  const db = createClient("https://db.example.test", "test", { auth: { persistSession: false }, global: { fetch: async (input, init) => {
    const url = new URL(String(input)), method = init?.method ?? "GET";
    calls.push({ url, method });
    assert.ok(url.toString().length < 8000, "query must fit the production proxy");
    if (fail?.(url, method)) return Response.json({ message: "later page failed" }, { status: 400 });
    const table = url.pathname.split("/").at(-1)!;
    let rows = tables[table] ?? [];
    for (const [key, value] of url.searchParams) {
      if (value.startsWith("in.(")) { const values = value.slice(4, -1).split(","); rows = rows.filter(r => values.includes(String(r[key]))); }
      if (value.startsWith("eq.") && rows.some(r => key in r)) rows = rows.filter(r => String(r[key]) === value.slice(3));
    }
    if (method === "PATCH") { const update = JSON.parse(String(init?.body)); for (const row of rows) Object.assign(row, update); return new Response(null, { status: 204 }); }
    assert.equal(method, "GET", "no unexpected writes or email sends");
    const offset = Number(url.searchParams.get("offset"));
    const limit = Math.min(1000, Number(url.searchParams.get("limit") ?? 1000));
    rows = rows.slice(offset, offset + limit);
    return Response.json(new Headers(init?.headers).get("accept")?.includes("vnd.pgrst.object") ? rows[0] ?? null : rows);
  } } });
  return { db, calls };
}
const uuid = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
const ids = Array.from({ length: 1205 }, (_, i) => uuid(i));

test("opening monitor counts all registrations, QR, contacts and errors beyond 1,000", async () => {
  const { db } = database({
    registrations: ids.map(id => ({ id, participant_id: id, event_id: "event", status: "submitted" })),
    participant_group_assignments: ids.map(id => ({ id, registration_id: id, is_current: true })),
    qr_tokens: ids.map(id => ({ id, registration_id: id })),
    participant_contacts: ids.map(id => ({ id, participant_id: id, email: "test@example.test", is_primary: true })),
    audit_logs: ids.map(id => ({ id, event_id: "event", action: "email.magic_link_failed" })),
  });
  const snapshot = fn("app/dashboard/admin/page.tsx", "getEventSnapshot", { ...loaders, serviceSupabase: db, getOpeningState: () => "open", summarizeRegistrationMonitoring: (rows: Row[]) => rows });
  const result = await snapshot({ id: "event" });
  assert.equal(result.summary.length, 1205);
  assert.equal(result.emailErrorsLast24Hours, 1205);
  assert.ok(result.summary.every((r: Row) => r.hasCurrentAssignment && r.hasQrToken && r.email));
});

test("operational identities load every account and reject incomplete pages", async () => {
  const tables = {
    profiles: ids.map(id => ({ id, email: `${id}@example.test`, full_name: "Fallback" })),
    participants: ids.map(id => ({ id, auth_user_id: id, first_name: "Given", last_name: id })),
    participant_contacts: ids.map(id => ({ id, participant_id: id, email: `${id}@example.test`, is_primary: true })),
  };
  const { db } = database(tables);
  const result = await getOperationalUserIdentities(db, ids);
  assert.equal(result.size, 1205);
  assert.equal(result.get(ids.at(-1)!)?.fullName, `Given ${ids.at(-1)}`);
  const broken = database(tables, url => url.pathname.endsWith("profiles") && url.searchParams.get("id")?.includes(ids[100]) === true);
  await assert.rejects(getOperationalUserIdentities(broken.db, ids), /later page failed/);
});

function campaignFixture(fail?: (url: URL, method: string) => boolean) {
  const recipients = ids.map(id => ({ id, campaign_id: "campaign", recipient_key: `participant:${id}`, recipient_type: "participant", participant_id: id, registration_id: id, delivery_kind: "direct", status: "pending" }));
  const campaign = { id: "campaign", status: "ready", event_id: "event", test_sent_at: "previous-test" };
  const { db, calls } = database({ email_campaigns: [campaign], email_campaign_recipients: recipients }, fail);
  const update = fn("app/api/email-campaigns/route.ts", "updateCampaignRecipients", {
    ...loaders, createSupabaseServiceClient: () => db, getCurrentOperationalEvent: async () => ({ id: "event" }),
    loadCampaignRecipientPreviews: async (rows: unknown[]) => rows,
    loadCampaignDeliveryData: async () => ({ templateData: { firstName: "A", lastName: "B" } }),
    audit: async () => {}, recipientSelectionSummary: () => ({}), renderCampaignTemplate: () => "", renderSafeCampaignHtml: () => "",
    NextResponse: { json: (value: unknown) => value },
  });
  return { update, recipients, calls, campaign };
}
test("campaign selection updates recipients after row 1,000, with bounded write filters", async () => {
  const { update, recipients } = campaignFixture();
  const result = await update("operator", "test@example.test", "campaign", recipients.filter((_, i) => i % 2 === 0).map(r => r.recipient_key));
  assert.equal(result.recipients.length, 1205);
  for (const [i, row] of recipients.entries()) assert.equal(row.status, i % 2 === 0 ? "pending" : "skipped");
});
test("campaign selection fails before any write if a later read page fails", async () => {
  const { update, recipients, calls } = campaignFixture(url => Number(url.searchParams.get("offset")) >= 500);
  await assert.rejects(update("operator", "test@example.test", "campaign", [recipients[0].recipient_key]), /later page failed/);
  assert.equal(calls.filter(c => c.method !== "GET").length, 0);
});
test("write batches stop at the first error", async () => {
  let calls = 0;
  await assert.rejects(loaders.writeRowsForIds(ids, async batch => { assert.ok(batch.length <= 100); return { error: ++calls === 2 ? { message: "write failed" } : null }; }), /write failed/);
  assert.equal(calls, 2);
});

test("existing Auth accounts beyond 1,000 are found; absence and read errors remain distinct", async () => {
  const pages: number[] = [];
  const db = { auth: { admin: { listUsers: async ({ page, perPage }: { page: number; perPage: number }) => {
    pages.push(page); return { data: { users: ids.slice((page - 1) * perPage, page * perPage).map(id => ({ id, email: `${id}@example.test` })) }, error: null };
  } } } } as unknown as Parameters<typeof findAuthUserByEmail>[0];
  assert.equal((await findAuthUserByEmail(db, `${ids.at(-1)}@example.test`))?.id, ids.at(-1));
  assert.deepEqual(pages, [1, 2, 3]);
  assert.equal(await findAuthUserByEmail(db, "absent@example.test"), null);
  db.auth.admin.listUsers = async () => ({ data: { users: [] }, error: { message: "auth failed" } }) as never;
  await assert.rejects(findAuthUserByEmail(db, "absent@example.test"), /auth failed/);
});

test("campaigns include every group leader beyond 1,000 memberships", async () => {
  const { db } = database({
    group_memberships: ids.map(id => ({ id, user_id: id, role: "capogruppo" })),
    profiles: ids.map(id => ({ id, full_name: "Leader", email: `${id}@example.test` })),
  });
  const resolve = fn("lib/email/campaign-recipients.server.ts", "resolveGroupLeaderRecipients", {
    ...loaders, createSupabaseServiceClient: () => db, loadDeletedUserIds: async () => new Set(), getOperationalUserIdentities,
  });
  const recipients = await resolve("event");
  assert.equal(recipients.length, 1205);
  assert.equal(recipients.at(-1).recipientUserId, ids.at(-1));
});

test("a single ID batch may span more than 1,000 child rows; later errors must reject", async () => {
  const tables = {
    profiles: [{ id: ids[0], email: "test@example.test" }],
    participants: [{ id: ids[0], auth_user_id: ids[0], first_name: "A", last_name: "B" }],
    participant_contacts: ids.map(id => ({ id, participant_id: ids[0], email: "test@example.test", is_primary: false })),
  };
  const { db, calls } = database(tables);
  assert.equal((await getOperationalUserIdentities(db, [ids[0]])).size, 1);
  assert.ok(calls.some(c => c.url.pathname.endsWith("participant_contacts") && Number(c.url.searchParams.get("offset")) === 1000));
  const broken = database(tables, url => url.pathname.endsWith("participant_contacts") && Number(url.searchParams.get("offset")) === 1000);
  await assert.rejects(getOperationalUserIdentities(broken.db, [ids[0]]), /later page failed/);
});


test("a failed selection write invalidates the previous send test", async () => {
  let writes = 0;
  const { update, recipients, campaign } = campaignFixture((url, method) => method === "PATCH" && url.pathname.endsWith("email_campaign_recipients") && ++writes === 2);
  await assert.rejects(update("operator", "test@example.test", "campaign", recipients.map(r => r.recipient_key)), /later page failed/);
  assert.equal(campaign.status, "draft");
  assert.equal(campaign.test_sent_at, null);
  assert.equal(writes, 2);
});
