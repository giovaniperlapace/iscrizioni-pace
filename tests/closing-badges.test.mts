import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { createCampaignBadge } from "../lib/email/campaign-badge.server.ts";
import { CLOSING_BADGE_SECTORS, closingBadgeColor, closingBadgeSector, CLOSING_BADGE_COPY } from "../lib/ceremonies/closing-badges.ts";
import { renderClosingBadgeEmail } from "../lib/ceremonies/closing-email.ts";
import { prepareClosingBadgeEmail } from "../lib/ceremonies/closing-email.server.ts";
import { ceremonySeatText, parseCeremonySeatInfo } from "../lib/ceremonies/seat-projection.ts";
import type { PublicationNotice } from "../lib/ceremonies/publication-email.ts";
import { sendTransactionalEmail, EmailDeliveryError } from "../lib/email/smtp.ts";

const id = "00000000-0000-4000-8000-000000000001";
const instructions = Object.fromEntries(CLOSING_BADGE_SECTORS.map(s => [s.code, { it: `ISTRUZIONI SINTETICHE ${s.color}`, en: `SYNTHETIC INSTRUCTIONS ${s.code}` }]));
const notice: PublicationNotice = { id, claim: id, eventId: id, userId: null, registrationId: id,
  payload: { kind: "closing", title: "Cerimonia finale", badgeWorkflow: true, startsAt: "2026-10-27T15:15:00Z", location: "Sede sintetica", instructions,
    lines: [{ nomineeId: id, name: "Ada <Test> & Famiglia", sector: "Chiesa Basilica inferiore", badgeCode: "CLOSING_ORANGE" }] } };

test("closing badge capacities and localized colors are distinct from opening sectors", () => {
  assert.equal(CLOSING_BADGE_SECTORS.reduce((sum, s) => sum + s.capacity, 0), 3500);
  assert.equal(closingBadgeSector("A"), null);
  assert.equal(closingBadgeSector("PRATO"), null);
  for (const locale of Object.keys(CLOSING_BADGE_COPY) as (keyof typeof CLOSING_BADGE_COPY)[]) {
    for (const badge of CLOSING_BADGE_SECTORS) assert.ok(closingBadgeColor(badge.code, locale));
  }
  const parsed = parseCeremonySeatInfo([{ kind: "closing", sector: "Piazza inferiore", needsSeat: true, review: false, seat: null, badgeCode: "CLOSING_PURPLE" }]);
  assert.ok(parsed); assert.match(ceremonySeatText(parsed[0]), /Piazza inferiore · Badge Viola/);
  assert.equal(parseCeremonySeatInfo([{ ...parsed[0], badgeCode: "bogus" }]), null);
  assert.equal(parseCeremonySeatInfo([{ ...parsed[0], kind: "opening" }]), null);
});

test("personal closing mail uses approved text and cutoff, escapes identity and places the badge before the farewell", () => {
  const mail = renderClosingBadgeEmail(notice, "https://example.invalid");
  assert.match(mail.html, /lang="it"[\s\S]*lang="en"/);
  assert.match(mail.html, /Ada &lt;Test&gt; &amp; Famiglia/);
  assert.equal(mail.text.split("\n\n---\n\n")[0], "Ciao Ada <Test> & Famiglia,\n\nl'immagine qui sotto è il biglietto di ingresso per partecipare alla cerimonia finale, lo trovi anche scaricabile in allegato a questa mail. Ti è stato assegnato il settore Chiesa Basilica inferiore. L’accesso sarà consentito entro le 14:30.\n\nBuona cerimonia finale!");
  assert.match(mail.text, /Entry will be permitted until 14:30/);
  assert.match(mail.html, /L’accesso sarà consentito entro le 14:30\.[\s\S]*src="cid:closing-badge-0@iscrizioni-pace"[\s\S]*Buona cerimonia finale!/);
  assert.doesNotMatch(mail.text, /16:15|ISTRUZIONI SINTETICHE|dashboard/);
  assert.deepEqual(renderClosingBadgeEmail({ ...notice, payload: { ...notice.payload, instructions: {} } }, "https://example.invalid"), mail);
});

test("family receives a downloadable PDF and unique inline badge for every explicit nominee", async () => {
  const family = { ...notice, payload: { ...notice.payload, lines: CLOSING_BADGE_SECTORS.map((s, i) => ({ nomineeId: `${id}-${i}`, name: `Persona sintetica ${i}`, sector: s.name, badgeCode: s.code })) } };
  const mail = await prepareClosingBadgeEmail(family, "https://example.invalid");
  const pdfs = mail.attachments.filter(file => file.contentType === "application/pdf");
  const images = mail.attachments.filter(file => file.contentType === "image/jpeg");
  assert.equal(pdfs.length, 3); assert.equal(images.length, 3);
  assert.equal(new Set(pdfs.map(p => p.filename)).size, 3);
  assert.equal(new Set(images.map(p => p.cid)).size, 3);
  for (const pdf of pdfs) { assert.equal(pdf.content.subarray(0, 4).toString(), "%PDF"); assert.ok(!pdf.cid); }
  for (const [index, img] of images.entries()) {
    assert.equal(mail.html.split(`src="cid:${img.cid}"`).length - 1, 2);
    assert.ok(mail.html.indexOf(`Ciao Persona sintetica ${index},`) < mail.html.indexOf(`src="cid:${img.cid}"`));
  }
  assert.doesNotMatch(mail.html, /src="https?:/);
  assert.ok(mail.attachments.reduce((n, a) => n + a.content.length, 0) < 6 * 1024 * 1024);
});

test("only Prato personal mail clarifies that seating is available in both languages", () => {
  for (const sector of CLOSING_BADGE_SECTORS) {
    const mail = renderClosingBadgeEmail({ ...notice, payload: { ...notice.payload, lines: [{ ...notice.payload.lines[0], sector: sector.name, badgeCode: sector.code }] } }, "https://example.invalid");
    for (const body of [mail.text, mail.html]) {
      if (sector.code === "CLOSING_GREEN") {
        assert.match(body, /Anche nel settore Prato Basilica superiore ci saranno posti a sedere\./);
        assert.match(body, /Seating will also be available/);
      } else assert.doesNotMatch(body, /posti a sedere|seating will/);
    }
  }
});

test("eleven family badges fit after compression without losing people, pixels, colors or PDF/inline correspondence", async () => {
  const lines = Array.from({ length: 11 }, (_, i) => {
    const sector = CLOSING_BADGE_SECTORS[i % CLOSING_BADGE_SECTORS.length];
    return { nomineeId: `${id}-${i}`, name: `Persona sintetica ${i}`, sector: sector.name, badgeCode: sector.code };
  });
  const family = { ...notice, payload: { ...notice.payload, lines } };
  const originals = [];
  for (const line of lines) originals.push(await createCampaignBadge({ firstName: line.name, lastName: "", groupName: "" }, closingBadgeSector(line.badgeCode)!.template));
  assert.ok(originals.reduce((n, b) => n + b.pdf.content.length + b.image.content.length, 0) > 6 * 1024 * 1024, "fixture reproduces the original failure");
  const mail = await prepareClosingBadgeEmail(family, "https://example.invalid");
  assert.equal(mail.attachments.length, 22);
  assert.equal(new Set(mail.attachments.map(file => file.filename)).size, 22);
  assert.ok(mail.attachments.reduce((n, a) => n + a.content.length, 0) < 6 * 1024 * 1024);
  for (const [i, line] of lines.entries()) {
    const [pdf, image] = mail.attachments.slice(i * 2, i * 2 + 2);
    assert.ok(pdf.content.includes(image.content));
    assert.ok(image.content.length < originals[i].image.content.length);
    assert.equal(image.cid, `closing-badge-${i}@iscrizioni-pace`);
    assert.equal(mail.html.split(`src="cid:${image.cid}"`).length - 1, 2);
    assert.ok(mail.text.includes(line.name));
    const metadata = await sharp(image.content).metadata();
    assert.equal(metadata.width, 941); assert.equal(metadata.height, 1672);
    const expected = await createCampaignBadge({ firstName: line.name, lastName: "", groupName: "" }, closingBadgeSector(line.badgeCode)!.template, { jpegQuality: 85 });
    assert.deepEqual(image.content, expected.image.content);
  }
  const ordinary = await prepareClosingBadgeEmail({ ...notice, payload: { ...notice.payload, lines: [lines[0]] } }, "https://example.invalid");
  assert.deepEqual(ordinary.attachments[1].content, originals[0].image.content, "ordinary mail retains original quality");
});

test("family compression still rejects duplicate identities and totals over the attachment limit", async () => {
  const line = notice.payload.lines[0];
  await assert.rejects(prepareClosingBadgeEmail({ ...notice, payload: { ...notice.payload, lines: [line, line] } }, "https://example.invalid"), /invalid_badge_identity/);
  const lines = Array.from({ length: 22 }, (_, i) => ({ ...line, nomineeId: `${id}-${i}`, name: `Persona sintetica ${i}` }));
  await assert.rejects(prepareClosingBadgeEmail({ ...notice, payload: { ...notice.payload, lines } }, "https://example.invalid"), /closing_badges_too_large/);
});

test("leader contact report includes all 1005 names without individual mail or attachment explosion", async () => {
  const report: PublicationNotice = { ...notice, userId: id, registrationId: null, payload: { ...notice.payload, noticeType: "leader_contacts", snapshotAt: "2026-10-26T15:00:00Z",
    lines: Array.from({ length: 1005 }, (_, i) => ({ ...notice.payload.lines[0], name: `Persona sintetica ${i + 1}` })) } };
  const mail = await prepareClosingBadgeEmail(report, "https://example.invalid");
  assert.match(mail.text, /Persona sintetica 1005/);
  assert.match(mail.text, /incaricato di contattarle/);
  assert.match(mail.text, /Snapshot as of/);
  assert.doesNotMatch(mail.text, /arriveranno con una mail separata|separate email/);
  assert.doesNotMatch(mail.html + mail.text, /Istruzioni di accesso ·|Entry instructions ·|ISTRUZIONI SINTETICHE|SYNTHETIC INSTRUCTIONS/);
  assert.deepEqual(renderClosingBadgeEmail({ ...report, payload: { ...report.payload, instructions: {} } }, "https://example.invalid"), renderClosingBadgeEmail(report, "https://example.invalid"));
  assert.equal(mail.attachments.length, 0);
  assert.match(mail.html, /dashboard capogruppo/);
  assert.ok(Buffer.byteLength(JSON.stringify(mail)) < 9_000_000);
});

test("group allocation notice requests nominal assignment and contains no personal badge", async () => {
  const mail = await prepareClosingBadgeEmail({ ...notice, userId: id, registrationId: null, payload: { ...notice.payload, lines: [{ ...notice.payload.lines[0], name: "Gruppo prova", quantity: 200 }] } }, "https://example.invalid");
  assert.match(mail.text, /200 posti/); assert.match(mail.text, /assegnali nominalmente/); assert.equal(mail.attachments.length, 0);
});

test("transactional transport refuses oversized encoded payload, empty attachment and invalid metadata before network", async () => {
  const input = { to: "test@example.invalid", subject: "Test", text: "Test", html: "<p>Test</p>" };
  const env = { ...process.env }; const fetch = globalThis.fetch;
  try {
    Object.assign(process.env, { EMAIL_DELIVERY_MODE: "postmark", POSTMARK_SERVER_TOKEN: "synthetic", EMAIL_FROM: "test@example.invalid", POSTMARK_TRANSACTIONAL_STREAM: "outbound" });
    globalThis.fetch = async () => { throw Error("Network must not run"); };
    for (const [change, code] of [
      [{ attachments: [{ filename: "badge.pdf", content: Buffer.alloc(7_000_000), contentType: "application/pdf" }] }, "postmark_message_too_large"],
      [{ attachments: [{ filename: "badge.pdf", content: Buffer.alloc(0), contentType: "application/pdf" }] }, "invalid_attachment"],
      [{ metadata: { ceremony_publication_email_id: id } }, "invalid_metadata"],
    ] as const) await assert.rejects(sendTransactionalEmail({ ...input, ...change, attachments: "attachments" in change ? [...change.attachments] : undefined }), (e: unknown) => e instanceof EmailDeliveryError && e.code === code);
  } finally { globalThis.fetch = fetch; for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key]; Object.assign(process.env, env); }
});
