import assert from "node:assert/strict";
import test from "node:test";
import { loadCampaignCeremonySectors } from "../lib/email/campaign-ceremony-sectors.server.ts";
import { renderCampaignTemplate, renderCampaignHtmlTemplate, validateCampaignTemplate } from "../lib/email/campaign-templates.ts";

const template = "{{settore_inaugurazione}} / {{settore_cerimonia_finale}}";
const person = { firstName: "Ada", lastName: "Test", participantCode: null, groupName: null, eventTitle: "Evento" };
test("ceremony fields validate, render independently, escape HTML and stay empty when unassigned", () => {
  assert.deepEqual(validateCampaignTemplate(template, template), []);
  assert.equal(renderCampaignTemplate(template, { ...person, openingSector: "A1", closingSector: "F" }), "A1 / F");
  assert.equal(renderCampaignTemplate(template, { ...person, closingSector: "B" }), " / B");
  assert.equal(renderCampaignTemplate(template, person), " / ");
  assert.equal(renderCampaignHtmlTemplate(template, { ...person, openingSector: "<A>" }), "&lt;A&gt; / ");
});

function fixture(rows: unknown[], failure = false, registered = true) {
  const filters: unknown[][] = [];
  const db = { from(table: string) {
    const q = {
      select() { return q; },
      eq(key: string, value: unknown) { filters.push([table, key, value]); return q; },
      is(key: string, value: unknown) { filters.push([table, key, value]); return q; },
      in(key: string, value: unknown) { filters.push([table, key, value]); return q; },
      maybeSingle: async () => ({ data: registered ? { id: "registration" } : null, error: null }),
      then(resolve: (value: unknown) => unknown) { return Promise.resolve({ data: rows, error: failure ? new Error("offline") : null }).then(resolve); },
    }; return q;
  } };
  return { db: db as unknown as Parameters<typeof loadCampaignCeremonySectors>[0], filters };
}
const row = (kind: string, name: string) => ({
  ceremony_plans: { kind }, ceremony_allocations: { ceremony_quotas: { ceremony_sectors: { name } } },
});
test("reads personal sectors through the nominee ledger with event, adult and active assignment scope", async () => {
  const { db, filters } = fixture([row("closing", "F"), row("opening", "A2")]);
  assert.deepEqual(await loadCampaignCeremonySectors(db, "event", "person", "registration"), { openingSector: "A2", closingSector: "F" });
  for (const filter of [
    ["registrations", "event_id", "event"], ["registrations", "participant_id", "person"],
    ["registrations", "id", "registration"], ["registrations", "deleted_at", null],
    ["ceremony_nominees", "registration_id", "registration"], ["ceremony_nominees", "child_id", null],
    ["ceremony_nominees", "revoked_at", null], ["ceremony_nominees", "ceremony_allocations.revoked_at", null],
    ["ceremony_nominees", "ceremony_plans.event_id", "event"], ["ceremony_nominees", "ceremony_plans.state", "validated"],
  ]) assert.ok(filters.some(value => JSON.stringify(value) === JSON.stringify(filter)), JSON.stringify(filter));
});
test("leaders without event registration and people without nominations have empty sectors", async () => {
  for (const registered of [false, true]) {
    const { db } = fixture([], false, registered);
    assert.deepEqual(await loadCampaignCeremonySectors(db, "event", "person"), { openingSector: null, closingSector: null });
  }
});
test("read failures and incomplete sector relations block rendering instead of claiming no assignment", async () => {
  for (const setup of [fixture([], true), fixture([{ ceremony_plans: { kind: "opening" } }])]) {
    await assert.rejects(loadCampaignCeremonySectors(setup.db, "event", "person"), /settori|Settore/);
  }
});

test("delivery uses the participant's assignment even when email goes to a delegate, and loads only for requested tokens", async () => {
  const { readFileSync } = await import("node:fs");
  const { default: ts } = await import("typescript");
  const exports: Record<string, unknown> = {};
  const calls: unknown[][] = [];
  const current = { recipientType: "participant", participantId: "person", registrationId: "registration", deliveryKind: "delegated", delegateUserId: "delegate" };
  const source = ts.transpileModule(readFileSync(new URL("../lib/email/campaign-delivery.server.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "exports", source)((id: string) => {
    if (id.includes("campaign-ceremony-sectors")) return { loadCampaignCeremonySectors: async (...args: unknown[]) => { calls.push(args.slice(1)); return { openingSector: "C", closingSector: "F" }; } };
    if (id.includes("campaign-recipients.server")) return { resolveCurrentParticipantRecipient: async () => current };
    if (id.includes("campaign-eligibility")) return { isCampaignRecipientOperational: async () => true };
    return {};
  }, exports);
  const db = { from(table: string) {
    const data = table === "participants" ? { first_name: "Ada", last_name: "Test", public_code: "TEST" } : table === "participant_group_assignments" ? {} : { email: "test@example.test" };
    const q = { select() { return q; }, eq() { return q; }, order() { return q; }, limit() { return q; }, single: async () => ({ data }), maybeSingle: async () => ({ data }) }; return q;
  } };
  const load = exports.loadCampaignDeliveryData as (...args: unknown[]) => Promise<{ templateData: { openingSector?: string; closingSector?: string } }>;
  const recipient = { ...current, deliveryKind: "delegated", delegateUserId: "old-delegate" };
  assert.equal((await load(db, "event", "Evento", recipient, false, template)).templateData.openingSector, "C");
  assert.deepEqual(calls, [["event", "person", "registration"]]);
  await load(db, "event", "Evento", recipient, false, "{{nome}}");
  assert.equal(calls.length, 1);
});
