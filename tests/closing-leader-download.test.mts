import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { closingLeaderDownloadTickets } from "../lib/ceremonies/closing-leader-download.ts";
import { streamClosingLeaderPdf } from "../lib/ceremonies/closing-leader-download.server.ts";
import { createCampaignBadgeImage } from "../lib/email/campaign-badge.server.ts";
import type { LeaderTickets } from "../lib/ceremonies/leader-tickets.ts";

function fixture(count = 3): LeaderTickets {
  return {
    allocations: ["CLOSING_ORANGE", "CLOSING_PURPLE", "CLOSING_GREEN"].map((badgeCode, i) => ({ id: `a${i}`, planId: "p", kind: "closing", badgeCode, state: "validated", revision: 1, groupId: `g${i}`, groupName: `Gruppo ${i}`, location: "Assisi", startsAt: "2026-10-27T15:15:00Z", sector: badgeCode, category: "delegations", quantity: count, used: count, numbered: false })),
    nominees: Array.from({ length: count }, (_, i) => ({ id: `n${i}`, allocationId: `a${i % 3}`, registrationId: `r${i}`, childId: null, needsSeat: true, name: "Nome storico", review: false })),
    people: Array.from({ length: count }, (_, i) => ({ registrationId: `r${i}`, name: `Persona ${i}`, code: "TEST", groupIds: [`g${i % 3}`], children: [], eligiblePlanIds: ["p"], assigned: [] })), tickets: [],
  };
}

test("all sectors and groups beyond 1000, current identities, explicit children only, deduplicated", () => {
  const view = fixture(1005);
  view.people[0].children = [{ id: "child", name: "Minore attuale" }, { id: "unselected", name: "Non selezionato" }];
  view.nominees.push({ ...view.nominees[0], id: "child-n", childId: "child" }, view.nominees[0]);
  const tickets = closingLeaderDownloadTickets(view);
  assert.equal(tickets.length, 1006);
  assert.equal(new Set(tickets.map(t => t.template)).size, 3);
  assert.ok(tickets.some(t => t.name === "Persona 1004"));
  assert.ok(tickets.some(t => t.name === "Minore attuale"));
  assert.ok(tickets.every(t => t.name !== "Nome storico" && t.name !== "Non selezionato"));
  assert.deepEqual(tickets, closingLeaderDownloadTickets({ ...view, nominees: [...view.nominees].reverse() }));
});

test("opening, unvalidated, missing scope/registration/child, revoked or unpaired and no-seat excluded", () => {
  for (const modify of [
    (v: LeaderTickets) => { v.allocations[0].kind = "opening"; },
    (v: LeaderTickets) => { v.allocations[0].state = "draft"; },
    (v: LeaderTickets) => { v.allocations[0].badgeCode = null; },
    (v: LeaderTickets) => { v.people = []; },
    (v: LeaderTickets) => { v.nominees[0].childId = "removed"; },
    (v: LeaderTickets) => { v.nominees[0].needsSeat = false; },
    (v: LeaderTickets) => { v.nominees = []; },
    (v: LeaderTickets) => { v.allocations = []; },
  ]) {
    const view = fixture(1); modify(view); assert.deepEqual(closingLeaderDownloadTickets(view), []);
  }
});

test("combined PDF has original page dimensions and identical personal badge images in order", async () => {
  const tickets = closingLeaderDownloadTickets(fixture());
  const pdf = Buffer.from(await new Response(streamClosingLeaderPdf(tickets)).arrayBuffer());
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.equal(pdf.toString("latin1").match(/\/Type \/Page\b/g)?.length, 3);
  assert.equal(pdf.toString("latin1").match(/\/MediaBox \[0 0 282\.3 501\.6\]/g)?.length, 3);
  let offset = 0;
  for (const ticket of tickets) {
    const { jpeg } = await createCampaignBadgeImage({ firstName: ticket.name, lastName: "", groupName: "" }, ticket.template);
    const position = pdf.indexOf(jpeg, offset);
    assert.ok(position >= offset); offset = position + jpeg.length;
  }
  assert.match(pdf.subarray(-50).toString(), /%%EOF/);
});

test("generation failure aborts stream rather than returning a partial successful file; cancel supported", async () => {
  const tickets = closingLeaderDownloadTickets(fixture());
  tickets[1].name = "x".repeat(1001);
  await assert.rejects(new Response(streamClosingLeaderPdf(tickets)).arrayBuffer(), /badge_generation_failed/);
  const stream = streamClosingLeaderPdf(closingLeaderDownloadTickets(fixture()));
  await stream.cancel();
  assert.throws(() => streamClosingLeaderPdf([]), /empty_badges/);
});

function route({ signedIn = true, failure = "", view = fixture() } = {}) {
  const calls: unknown[] = [];
  const dependencies: Record<string, unknown> = {
    "@/lib/supabase/server": { createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: signedIn ? { id: "actor" } : null } }) } }) },
    "@/lib/supabase/service": { createSupabaseServiceClient: () => ({}) },
    "@/lib/ceremonies/leader-tickets.server": { loadLeaderTickets: async () => { calls.push("canonical_read"); if (failure) throw Error(failure); return view; } },
    "@/lib/ceremonies/closing-leader-download": { closingLeaderDownloadTickets },
    "@/lib/ceremonies/closing-leader-download.server": { streamClosingLeaderPdf: (tickets: unknown) => { calls.push(tickets); return new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode("%PDF-synthetic")); c.close(); } }); } },
  };
  const exports = {} as { GET: () => Promise<Response> };
  const code = ts.transpileModule(readFileSync("app/dashboard/ceremonies/badges/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "exports", code)((key: string) => { assert.ok(key in dependencies, key); return dependencies[key]; }, exports);
  return { ...exports, calls };
}

test("download route authenticated, fresh canonical scope, private stream with PDF attachment", async () => {
  const r = route(); const response = await r.GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "application/pdf");
  assert.match(response.headers.get("Content-Disposition")!, /attachment;.*tutti-i-biglietti\.pdf/);
  assert.match(response.headers.get("Cache-Control")!, /private, no-store/);
  assert.match(await response.text(), /^%PDF-/);
  assert.equal(r.calls[0], "canonical_read");
  assert.equal((r.calls[1] as unknown[]).length, 3);
});

test("unauthorized, lost scope, empty snapshot and technical error never generate a PDF", async () => {
  for (const [options, status] of [[{ signedIn: false }, 401], [{ failure: "forbidden" }, 403], [{ view: fixture(0) }, 404], [{ failure: "unavailable" }, 503]] as const) {
    const r = route(options); const response = await r.GET();
    assert.equal(response.status, status);
    assert.match(response.headers.get("Cache-Control")!, /no-store/);
    assert.equal(r.calls.some(Array.isArray), false);
  }
});
