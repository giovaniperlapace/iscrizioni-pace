import * as closingFilter from "../lib/email/campaign-closing-sector.server.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import ts from "typescript";
import * as badge from "../lib/email/campaign-badge.server.ts";
import { CAMPAIGN_BADGE_TEMPLATE, CAMPAIGN_BADGE_TEMPLATES } from "../lib/email/campaign-badge.ts";
import { renderCampaignTemplate } from "../lib/email/campaign-templates.ts";
import { renderSafeCampaignHtml, campaignHtmlToText } from "../lib/email/campaign-html.server.ts";
import type { SendEmailInput } from "../lib/email/smtp.ts";

async function fixture(enabled: boolean, groupFailure = false, templates?: string[], closingSector?: string) {
  const deliveries: SendEmailInput[] = [];
  const changes: Record<string, unknown>[] = [];
  const rows = ["ada", "jose"].map(name => ({ id: name, campaign_id: "campaign", recipient_key: name,
    recipient_type: "participant", participant_id: name, registration_id: name, delivery_kind: "delegated", delegate_user_id: "leader", status: "sending" }));
  const campaign = { id: "campaign", event_id: "event", subject_template: "Ciao {{nome}}", body_template: "<p>Benvenuto {{nome}}</p>",
    filters_snapshot: templates ? { badgeTemplates: templates } : enabled ? { badgeTemplate: CAMPAIGN_BADGE_TEMPLATE } : {}, events: { title: "Evento" } };
  if (closingSector) Object.assign(campaign.filters_snapshot, { closingSector });
  const db = {
    rpc: async () => ({ data: rows }),
    storage: { from: () => ({ download: async () => ({ data: new Blob(["common attachment"]) }) }) },
    from(table: string) {
      const filters: Record<string, unknown> = {};
      let mutation = false;
      let columns = "";
      const result = () => {
        let data: unknown = null;
        if (table === "email_campaigns") data = [campaign];
        if (table === "email_campaign_attachments") data = [{ file_name: "programma.txt", content_type: "text/plain", storage_path: "common", is_inline: false }];
        if (table === "participants") data = { first_name: filters.id === "ada" ? "Ada" : "José", last_name: "Test", public_code: "TEST" };
        if (table === "participant_group_assignments") {
          // Production has both the current group and the escalation-source FK.
          if (columns === "groups(name)") return { data: null, error: { code: "PGRST201" } };
          assert.equal(columns, "groups!participant_group_assignments_group_id_fkey(name)");
          assert.equal(filters.is_current, true);
          data = { groups: { name: filters.registration_id === "ada" ? "Roma" : "Madrid" } };
        }
        if (table === "profiles") data = { email: "delegate@example.invalid" };
        if (table === "moment_attendance_choices") data = [];
        return { data, error: !mutation && groupFailure && table === "participant_group_assignments" ? new Error("group unavailable") : null, count: filters.status === "sent" ? 2 : 0 };
      };
      const query = {
        select(value: string) { columns = value; return query; }, eq(key: string, value: unknown) { filters[key] = value; return query; },
        is() { return query; }, range() { return Promise.resolve({ data: [], error: null }); },
        in() { return query; }, not() { return query; }, order() { return query; }, limit() { return query; },
        update(value: Record<string, unknown>) { mutation = true; changes.push(value); return query; }, insert() { mutation = true; return query; },
        single: async () => result(), maybeSingle: async () => table === "email_campaigns" ? ({ data: { retry_of_campaign_id: null } }) : result(),
        then(resolve: (value: unknown) => unknown) { return Promise.resolve(result()).then(resolve); },
      }; return query;
    },
  };
  const exports: Record<string, unknown> = {};
  const source = ts.transpileModule(readFileSync(new URL("../lib/email/campaign-delivery.server.ts", import.meta.url), "utf8")
    .replace("async function processCampaignBlock", "export async function processCampaignBlock"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "exports", source)((id: string) => {
    if (id.includes("campaign-closing-sector.server")) return closingFilter;
    if (id.includes("campaign-badge.server")) return badge;
    if (id === "node:crypto") return { createHash };
    if (id.includes("campaign-templates")) return { renderCampaignTemplate };
    if (id.includes("campaign-html.server")) return { renderSafeCampaignHtml, campaignHtmlToText };
    if (id.includes("campaign-eligibility")) return { isCampaignRecipientOperational: async () => true, RegistrationNotOperationalError: class extends Error {} };
    if (id.includes("campaign-recipients.server")) return { resolveCurrentParticipantRecipient: async (_event: string, registration: string) => ({ participantId: registration, registrationId: registration, recipientType: "participant", deliveryKind: "delegated", delegateUserId: "leader" }) };
    if (id.includes("email/config")) return { getEmailConfig: () => ({}) };
    if (id.includes("supabase/service")) return { createSupabaseServiceClient: () => db };
    if (id.includes("campaign-scheduling")) return { getCampaignLocalDate: () => "2026-10-26" };
    if (id.includes("campaign-report")) return { emailHash: () => "hash" };
    if (id.includes("email/smtp")) return { EmailDeliveryError: class extends Error {}, sendBroadcastBatch: async (inputs: SendEmailInput[]) => { deliveries.push(...inputs); return inputs.map((_, i) => ({ messageId: `message-${i}` })); } };
    return {};
  }, exports);
  const run = exports.processCampaignBlock as (options: object) => Promise<{ sent: number; failed: number }>;
  const result = await run({});
  return { result, deliveries, changes, exports };
}

test("queue sends each delegate the participant's own inline badge and PDF alongside common files", async () => {
  const { result, deliveries } = await fixture(true);
  assert.equal(result.sent, 2); assert.equal(result.failed, 0); assert.equal(deliveries.length, 2);
  assert.ok(deliveries.every(input => input.to === "delegate@example.invalid"));
  for (const input of deliveries) {
    assert.equal(input.attachments?.length, 3);
    const pdf = input.attachments!.find(item => item.contentType === "application/pdf")!;
    const image = input.attachments!.find(item => item.contentType === "image/jpeg")!;
    assert.match(input.html, /src="cid:personalized-badge@iscrizioni-pace"/);
    assert.equal(image.cid, "personalized-badge@iscrizioni-pace");
    assert.ok(pdf.content.includes(image.content));
    const isAda = input.subject.includes("Ada");
    const expected = await badge.createCampaignBadge({ firstName: isAda ? "Ada" : "José", lastName: "Test", groupName: isAda ? "Roma" : "Madrid" });
    assert.deepEqual(image.content, expected.image.content);
  }
  assert.notDeepEqual(deliveries[0].attachments![2].content, deliveries[1].attachments![2].content);
});

test("old campaigns send only common files; failed identity reads send no incomplete badge", async () => {
  const old = await fixture(false);
  assert.equal(old.result.sent, 2);
  assert.ok(old.deliveries.every(input => input.attachments?.length === 1 && !input.html.includes("cid:")));
  const failed = await fixture(true, true);
  assert.equal(failed.result.sent, 0); assert.equal(failed.result.failed, 2);
  assert.equal(failed.deliveries.length, 0);
});

test("worker preserves three selected badges for every recipient and references all three inline images", async () => {
  const { result, deliveries } = await fixture(true, false, CAMPAIGN_BADGE_TEMPLATES.map(template => template.id));
  assert.equal(result.sent, 2); assert.equal(result.failed, 0);
  for (const input of deliveries) {
    assert.equal(input.attachments?.length, 7);
    for (const template of CAMPAIGN_BADGE_TEMPLATES) {
      assert.ok(input.html.includes(`src="cid:${template.cid}"`));
      const pdf = input.attachments!.find(attachment => attachment.filename === `${template.fileStem}.pdf`)!;
      const image = input.attachments!.find(attachment => attachment.cid === template.cid)!;
      assert.ok(pdf.content.includes(image.content));
    }
  }
});

 test("queued sector campaigns skip people whose nominal assignment was revoked before sending", async () => {
  const { result, deliveries, changes } = await fixture(false, false, undefined, "CLOSING_GREEN");
  assert.equal(result.sent, 0); assert.equal(result.failed, 0); assert.equal(deliveries.length, 0);
  assert.equal(changes.filter(change => change.status === "skipped" && change.error_code === "closing_sector_changed").length, 2);
});
