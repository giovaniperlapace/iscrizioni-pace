import assert from "node:assert/strict";
import test from "node:test";
import { CLOSING_BADGE_SECTORS } from "../lib/ceremonies/closing-badges.ts";
import { prepareClosingBadgeEmail } from "../lib/ceremonies/closing-email.server.ts";
import { createClosingLeaderBadgePdfs } from "../lib/ceremonies/closing-leader-badges.server.ts";
import type { PublicationNotice } from "../lib/ceremonies/publication-email.ts";

const id = "00000000-0000-4000-8000-000000000001";
const notice: PublicationNotice = { id, claim: id, eventId: id, userId: id, registrationId: null,
  payload: { kind: "closing", badgeWorkflow: true, noticeType: "leader_contacts", title: "Cerimonia finale", snapshotAt: "2026-10-26T18:00:00Z", startsAt: "2026-10-27T15:15:00Z", location: "Sede sintetica",
    instructions: Object.fromEntries(CLOSING_BADGE_SECTORS.map(s => [s.code, { it: "ISTRUZIONI SINTETICHE", en: "SYNTHETIC INSTRUCTIONS" }])), lines: [] } };
const person = (i: number, sector = 0) => ({ name: `Persona sintetica ${i}`, nomineeId: `synthetic-${i}`, groupId: id, groupName: "Gruppo sintetico", badgeCode: CLOSING_BADGE_SECTORS[sector].code, sector: CLOSING_BADGE_SECTORS[sector].name, communicationDelegated: true });

test("leader report attaches one landscape A4 PDF for each delegated sector, with pagination", async () => {
  const email = await prepareClosingBadgeEmail({ ...notice, payload: { ...notice.payload, lines: [
    ...Array.from({ length: 8 }, (_, i) => person(i)), person(8, 2), { ...person(9, 1), communicationDelegated: false },
  ] } }, "https://example.invalid");
  assert.equal(email.attachments.length, 2);
  assert.deepEqual(email.attachments.map(a => a.filename), ["cerimonia-finale-badge-arancione.pdf", "cerimonia-finale-badge-verde.pdf"]);
  for (const [index, pdf] of email.attachments.entries()) {
    assert.equal(pdf.contentType, "application/pdf"); assert.ok(!pdf.cid);
    assert.equal(pdf.content.subarray(0, 4).toString(), "%PDF");
    const source = pdf.content.toString("latin1");
    assert.equal((source.match(/\/Type \/Page\b/g) ?? []).length, index === 0 ? 2 : 1);
    assert.match(source, /\/MediaBox \[0 0 841\.89 595\.28\]/);
  }
  assert.match(email.text, /un PDF allegato per ogni settore/);
  assert.match(email.text, /a PDF is attached for each relevant sector/);
  assert.doesNotMatch(email.text, /ritagli|cut along|cut out|100%/);
  assert.doesNotMatch(email.html, /<img/);
});

test("only explicit delegate flags authorize strip PDFs; malformed identities fail closed", async () => {
  for (const communicationDelegated of [undefined, false]) {
    const email = await prepareClosingBadgeEmail({ ...notice, payload: { ...notice.payload, lines: [{ ...person(0), communicationDelegated }] } }, "https://example.invalid");
    assert.equal(email.attachments.length, 0); assert.doesNotMatch(email.text, /un PDF allegato per ogni settore/);
  }
  for (const change of [{ groupId: undefined }, { nomineeId: undefined }, { name: " " }, { badgeCode: "B" }, { name: "A".repeat(1001) }]) {
    await assert.rejects(createClosingLeaderBadgePdfs({ ...notice, payload: { ...notice.payload, lines: [{ ...person(0), ...change }] } }), /invalid_delegated_badge_identity/);
  }
  await assert.rejects(createClosingLeaderBadgePdfs({ ...notice, payload: { ...notice.payload, lines: [person(0), person(0, 1)] } }), /invalid_delegated_badge_identity/);
  await assert.rejects(createClosingLeaderBadgePdfs({ ...notice, userId: null }), /invalid_leader_badge_report/);
});

test("1005 delegate badges stay in three bounded PDFs with no 1000-person truncation", async () => {
  const email = await prepareClosingBadgeEmail({ ...notice, payload: { ...notice.payload, lines: Array.from({ length: 1005 }, (_, i) => person(i, i % 3)) } }, "https://example.invalid");
  assert.equal(email.attachments.length, 3);
  for (const pdf of email.attachments) assert.equal((pdf.content.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length, Math.ceil(335 / 7));
  assert.match(email.text, /Persona sintetica 1004/);
  assert.ok(email.attachments.reduce((sum, file) => sum + file.content.length, 0) < 6 * 1024 * 1024);
  assert.ok(Buffer.byteLength(JSON.stringify({ TextBody: email.text, HtmlBody: email.html, Attachments: email.attachments.map(a => ({ Name: a.filename, ContentType: a.contentType, Content: a.content.toString("base64") })) })) < 9_000_000);
});
