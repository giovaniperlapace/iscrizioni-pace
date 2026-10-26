import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { CAMPAIGN_BADGE_TEMPLATE, CAMPAIGN_BADGE_TEMPLATES, campaignBadgeRequest, campaignBadgeSelectionRequest, campaignBadgeTemplates, campaignHasBadge } from "../lib/email/campaign-badge.ts";
import { createCampaignBadge, campaignAttachmentsForRecipient, campaignBadgePreviews } from "../lib/email/campaign-badge.server.ts";
import { selectCampaignSample } from "../lib/email/campaign-selection.ts";

const snapshot = { badgeTemplate: CAMPAIGN_BADGE_TEMPLATE };
const person = { firstName: "Maria Luisa", lastName: "De Santis", groupName: "Comunità di Sant’Egidio · Roma" };

test("badge is opt-in, participant-only, versioned and absent on old campaigns", () => {
  for (const value of [undefined, false, "false"]) assert.equal(campaignBadgeRequest(value, "participants"), null);
  for (const value of [true, "true"]) assert.equal(campaignBadgeRequest(value, "participants"), CAMPAIGN_BADGE_TEMPLATE);
  for (const value of ["on", "1", 1, {}, null]) assert.throws(() => campaignBadgeRequest(value, "participants"));
  assert.throws(() => campaignBadgeRequest(true, "teachers"));
  assert.throws(() => campaignBadgeRequest(true, "group_leaders"));
  assert.equal(campaignHasBadge({ audience: "participants" }), false);
  assert.equal(campaignHasBadge(snapshot), true);
  assert.throws(() => campaignHasBadge({ badgeTemplate: "unknown" }));
});

test("personal PDF embeds the very same JPEG attached inline, preserving source dimensions", async () => {
  const { pdf, image } = await createCampaignBadge(person);
  const metadata = await sharp(image.content).metadata();
  assert.equal(metadata.width, 941); assert.equal(metadata.height, 1672);
  assert.equal(pdf.content.subarray(0, 5).toString(), "%PDF-");
  assert.equal(pdf.content.toString("latin1").match(/\/Type \/Page\b/g)?.length, 1);
  assert.ok(pdf.content.includes(image.content));
  assert.equal(image.contentType, "image/jpeg"); assert.equal(image.inline, true); assert.ok(image.cid);
  assert.equal(pdf.contentType, "application/pdf"); assert.equal(pdf.inline, false); assert.equal(pdf.cid, undefined);
});

test("concurrent recipients never share personalized badges and preserve common attachments", async () => {
  const common = [{ filename: "programma.pdf", content: Buffer.from("common"), contentType: "application/pdf", inline: false }];
  const [first, second, unchanged] = await Promise.all([
    campaignAttachmentsForRecipient(common, snapshot, person),
    campaignAttachmentsForRecipient(common, snapshot, { firstName: "José", lastName: "D’Ávila", groupName: null }),
    campaignAttachmentsForRecipient(common, {}, person),
  ]);
  assert.equal(common.length, 1); assert.equal(first.length, 3); assert.equal(second.length, 3);
  assert.equal(first[0], common[0]); assert.equal(second[0], common[0]); assert.equal(unchanged, common);
  assert.notDeepEqual(first[2].content, second[2].content);
  const [preview] = await campaignBadgePreviews(snapshot, person);
  assert.deepEqual(Buffer.from(preview!.imageBase64, "base64"), first[2].content);
  assert.deepEqual(Buffer.from(preview!.pdfBase64, "base64"), first[1].content);
  assert.deepEqual(await campaignBadgePreviews({}, person), []);
});

test("long names, accented text, literal markup and missing group render without new pages", async () => {
  for (const identity of [
    { firstName: "Maria Alessandra Francesca", lastName: "De Santis Della Valle Fernández", groupName: "Comunità di Sant’Egidio - Delegazione internazionale di San Salvador e Santa Ana" },
    { firstName: "Élodie <b>", lastName: "D’Ávila & Rossi", groupName: null },
  ]) {
    const badge = await createCampaignBadge(identity);
    assert.equal(badge.pdf.content.toString("latin1").match(/\/Type \/Page\b/g)?.length, 1);
    assert.ok(badge.image.content.length < 600_000);
  }
  await assert.rejects(createCampaignBadge({ firstName: "", lastName: "", groupName: null }), /Nome/);
  await assert.rejects(createCampaignBadge({ ...person, firstName: "x".repeat(1001) }), /lungo/);
});

test("attachment budget includes both PDF and inline image and fails before sending", async () => {
  await assert.rejects(campaignBadgePreviews(snapshot, person, 6 * 1024 * 1024), /6 MB/);
  await assert.rejects(campaignAttachmentsForRecipient([{ filename: "big", content: Buffer.alloc(6 * 1024 * 1024), contentType: "application/pdf", inline: false }], snapshot, person), /6 MB/);
});

test("preview and test sample are identical regardless of database row order", () => {
  const recipients = [{ recipientKey: "z" }, { recipientKey: "a" }, { recipientKey: "b" }];
  const selected = new Set(["z", "b"]);
  assert.equal(selectCampaignSample(recipients, selected)?.recipientKey, "b");
  assert.equal(selectCampaignSample([...recipients].reverse().filter(r => selected.has(r.recipientKey)))?.recipientKey, "b");
  assert.deepEqual(recipients.map(r => r.recipientKey), ["z", "a", "b"]);
});

test("multiple badge choices validate, deduplicate and retain legacy violet snapshots", () => {
  const ids = CAMPAIGN_BADGE_TEMPLATES.map(template => template.id);
  assert.deepEqual(campaignBadgeSelectionRequest(JSON.stringify([...ids].reverse()), "participants"), ids);
  assert.deepEqual(campaignBadgeSelectionRequest([ids[1], ids[1]], "participants"), [ids[1]]);
  assert.deepEqual(campaignBadgeSelectionRequest(undefined, "participants", "true"), [ids[0]]);
  assert.deepEqual(campaignBadgeTemplates({ badgeTemplate: ids[0] }), [ids[0]]);
  assert.deepEqual(campaignBadgeTemplates({ badgeTemplate: ids[0], badgeTemplates: [] }), []);
  for (const value of [null, {}, "{bad", ["../secret"], [ids[0], 1], [...ids, ids[0]]]) {
    assert.throws(() => campaignBadgeSelectionRequest(value, "participants"));
  }
  assert.throws(() => campaignBadgeSelectionRequest(ids, "group_leaders"));
  assert.throws(() => campaignBadgeTemplates({ badgeTemplates: ["unknown"] }));
});

test("all eight combinations produce only the requested templates with distinct PDFs and CIDs", async () => {
  for (let mask = 0; mask < 8; mask++) {
    const chosen = CAMPAIGN_BADGE_TEMPLATES.filter((_, index) => mask & (1 << index));
    const selected = { badgeTemplates: chosen.map(template => template.id) };
    const attachments = await campaignAttachmentsForRecipient([], selected, person);
    const previews = await campaignBadgePreviews(selected, person);
    assert.equal(attachments.length, chosen.length * 2);
    assert.equal(previews.length, chosen.length);
    assert.equal(new Set(attachments.map(a => a.filename)).size, attachments.length);
    assert.equal(new Set(attachments.filter(a => a.cid).map(a => a.cid)).size, chosen.length);
    for (const [index, template] of chosen.entries()) {
      const [pdf, image] = attachments.slice(index * 2, index * 2 + 2);
      assert.equal(pdf.filename, `${template.fileStem}.pdf`);
      assert.equal(image.cid, template.cid);
      assert.ok(pdf.content.includes(image.content));
      assert.equal(previews[index].templateId, template.id);
      assert.deepEqual(Buffer.from(previews[index].imageBase64, "base64"), image.content);
      const { data: pixel } = await sharp(image.content).extract({ left: 20, top: 20, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
      if (template.id.includes("verde")) assert.ok(pixel[1] > pixel[0] && pixel[1] > pixel[2]);
      if (template.id.includes("arancione")) assert.ok(pixel[0] > 200 && pixel[0] > pixel[1] && pixel[1] > pixel[2]);
      if (template.id.includes("viola")) assert.ok(pixel[2] > pixel[1] && pixel[0] > pixel[1]);
    }
  }
});

test("size limit includes every selected PDF and inline image", async () => {
  const selected = { badgeTemplates: CAMPAIGN_BADGE_TEMPLATES.map(template => template.id) };
  await assert.rejects(campaignBadgePreviews(selected, person, 5 * 1024 * 1024), /6 MB/);
});
