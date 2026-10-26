import assert from "node:assert/strict";
import test from "node:test";
import { campaignClosingSector, loadCampaignClosingAssignments, filterCampaignClosingRecipients, assertCampaignClosingRecipient, ClosingSectorChangedError } from "../lib/email/campaign-closing-sector.server.ts";
import { publicCampaignError } from "../lib/email/public-errors.ts";
import { reportOutcome } from "../lib/email/campaign-report.ts";
import type { CampaignRecipient } from "../lib/email/campaign-recipients.server.ts";

const row = (registration: string, code = "CLOSING_GREEN") => ({ id: registration, registration_id: registration, ceremony_allocations: { ceremony_quotas: { ceremony_sectors: { layout_code: code } } } });
function fixture(rows: ReturnType<typeof row>[], failure = false) {
  const filters: unknown[][] = [];
  const pages: number[] = [];
  const db = { from(table: string) {
    assert.equal(table, "ceremony_nominees");
    const q = {
      select() { return q; },
      eq(key: string, value: unknown) { filters.push([key, value]); return q; },
      is(key: string, value: unknown) { filters.push([key, value]); return q; },
      in(key: string, value: unknown) { filters.push([key, value]); return q; },
      order() { return q; },
      range(from: number, to: number) { pages.push(from); return Promise.resolve({ data: rows.slice(from, to + 1), error: failure ? { message: "offline" } : null }); },
    }; return q;
  } };
  return { db: db as unknown as Parameters<typeof loadCampaignClosingAssignments>[0], filters, pages };
}
const recipient = (id: string, delegated = false): CampaignRecipient => ({ recipientKey: `participant:${id}`, recipientType: "participant", registrationId: id, participantId: id, recipientUserId: null, deliveryKind: delegated ? "delegated" : "direct", delegateUserId: delegated ? "leader" : null, schoolTeacherId: null });

test("sector filters validate strictly while old campaign snapshots stay compatible", () => {
  for (const value of [null, undefined, ""]) assert.equal(campaignClosingSector(value), null);
  assert.equal(campaignClosingSector("CLOSING_PURPLE"), "CLOSING_PURPLE");
  for (const value of ["A", "PRATO", {}, true]) assert.throws(() => campaignClosingSector(value), /non valido/);
});
test("full paginated nominee ledger is restricted to published active adult tickets in current closing plan and event", async () => {
  const { db, filters, pages } = fixture(Array.from({ length: 1005 }, (_, i) => row(`r${i}`)));
  const assignments = await loadCampaignClosingAssignments(db, "event");
  assert.equal(assignments.size, 1005);
  assert.deepEqual(assignments.get("r1004"), ["CLOSING_GREEN"]);
  assert.deepEqual(pages, [0, 500, 1000]);
  for (const value of [["child_id", null], ["revoked_at", null], ["ceremony_allocations.revoked_at", null], ["ceremony_plans.event_id", "event"], ["ceremony_plans.kind", "closing"], ["ceremony_plans.state", "validated"], ["ceremony_plans.layout_key", "assisi-closing-badges-2026"], ["registrations.event_id", "event"], ["registrations.deleted_at", null], ["registrations.status", ["submitted", "confirmed"]]]) assert.ok(filters.some(f => JSON.stringify(f) === JSON.stringify(value)), JSON.stringify(value));
});
test("filter intersects selections without changing direct or delegated contacts or including unassigned groups", async () => {
  const { db } = fixture([row("a"), row("b"), row("c", "CLOSING_PURPLE")]);
  const recipients = [recipient("a"), recipient("b", true), recipient("c"), recipient("no-ticket"), { ...recipient("a"), recipientType: "group_leader" as const }];
  assert.deepEqual(await filterCampaignClosingRecipients(db, "event", recipients, "CLOSING_GREEN"), recipients.slice(0, 2));
  assert.equal(await filterCampaignClosingRecipients(db, "event", recipients, null), recipients);
});
test("queue recheck prevents revoked or moved assignments, preserves old campaigns and reports exclusion", async () => {
  await assertCampaignClosingRecipient(fixture([]).db, "event", recipient("a"), {});
  for (const rows of [[], [row("a", "CLOSING_PURPLE")]]) await assert.rejects(assertCampaignClosingRecipient(fixture(rows).db, "event", recipient("a"), { closingSector: "CLOSING_GREEN" }), ClosingSectorChangedError);
  const { db, filters } = fixture([row("a")]);
  await assertCampaignClosingRecipient(db, "event", recipient("a", true), { closingSector: "CLOSING_GREEN" });
  assert.ok(filters.some(f => f[0] === "registration_id" && f[1] === "a"));
  assert.equal(publicCampaignError(new ClosingSectorChangedError(), "send").status, 400);
  assert.match(reportOutcome({ status: "skipped", error_code: "closing_sector_changed" }, []).reason, /revocato o settore cambiato/);
});
test("read failures and malformed relations block selection instead of widening audience", async () => {
  await assert.rejects(filterCampaignClosingRecipients(fixture([], true).db, "event", [recipient("a")], "CLOSING_GREEN"), /offline/);
  await assert.rejects(loadCampaignClosingAssignments(fixture([row("a", "A")]).db, "event"), /Impossibile/);
});
