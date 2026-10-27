import PDFDocument from "pdfkit";
import { ClosingBadgeSheet } from "./closing-badge-sheet.ts";
import path from "node:path";
import { CLOSING_BADGE_SECTORS } from "./closing-badges.ts";
import type { PublicationNotice } from "./publication-email.ts";
import type { SendEmailInput } from "../email/smtp.ts";

const font = path.join(process.cwd(), "lib/qrcode/fonts/NotoSans-Regular.ttf");
const perPage = 7;
const clean = (value: string) => value.replace(/\s+/g, " ").trim();

// Vector artwork and one embedded font keep even large groups small enough to
// attach. These sheets contain only the delegate identities selected at claim.
export async function createClosingLeaderBadgePdfs(notice: PublicationNotice): Promise<NonNullable<SendEmailInput["attachments"]>> {
  return createClosingLeaderBadgeAttachments(notice, false);
}

export async function createClosingLeaderBadgeAttachments(notice: PublicationNotice, previews = true): Promise<NonNullable<SendEmailInput["attachments"]>> {
  if (!notice.userId || notice.registrationId || notice.payload.noticeType !== "leader_contacts" || !notice.payload.badgeWorkflow) throw Error("invalid_leader_badge_report");
  const lines = notice.payload.lines.filter(line => line.communicationDelegated === true);
  const seen = new Set<string>();
  for (const line of lines) {
    if (!line.nomineeId || !line.groupId || !line.name?.trim() || line.name.length > 1000 || !CLOSING_BADGE_SECTORS.some(s => s.code === line.badgeCode) || seen.has(line.nomineeId)) throw Error("invalid_delegated_badge_identity");
    seen.add(line.nomineeId);
  }
  if (!lines.length) return [];
  const snapshot = new Date(notice.payload.snapshotAt ?? "");
  const start = new Date(notice.payload.startsAt);
  if (!Number.isFinite(snapshot.getTime()) || !Number.isFinite(start.getTime())) throw Error("invalid_badge_report_date");
  const snapshotLabel = new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Rome" }).format(snapshot);
  const ceremonyDate = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Rome" }).format(start);
  const attachments: NonNullable<SendEmailInput["attachments"]> = [];
  for (const sector of CLOSING_BADGE_SECTORS) {
    const people = lines.filter(line => line.badgeCode === sector.code).sort((a, b) => clean(a.name).localeCompare(clean(b.name), "it", { numeric: true }) || a.nomineeId!.localeCompare(b.nomineeId!));
    if (!people.length) continue;
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 0, font, autoFirstPage: false,
      info: { Title: `Cerimonia finale - Badge ${sector.color}`, CreationDate: snapshot, ModDate: snapshot } });
    const chunks: Buffer[] = [];
    const result = new Promise<Buffer>((resolve, reject) => {
      doc.on("data", chunk => chunks.push(chunk)); doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject);
    });
    const pages = Math.ceil(people.length / perPage);
    for (let page = 0; page < pages; page++) {
      doc.addPage();
      const sheet = new ClosingBadgeSheet(doc, font, previews);
      const left = 28.35, width = doc.page.width - 2 * left;
      sheet.rect(left, 25, 5, 37, sector.hex);
      sheet.text(`Cerimonia finale - Badge ${sector.color}`, left + 15, 23, 16, "#182230");
      sheet.text(`${sector.name} | ${people.length} persone | ${ceremonyDate}`, left + 15, 47, 10, "#455468");
      for (const [row, person] of people.slice(page * perPage, (page + 1) * perPage).entries()) {
        const top = 80 + row * 70, height = 62, labelWidth = 166, closureWidth = 62;
        sheet.rect(left, top, width, height, "#ffffff");
        sheet.rect(left, top, labelWidth, height, sector.hex);
        sheet.text(`BADGE ${sector.color.toUpperCase()}`, left + 10, top + 6, 8, "#ffffff");
        sheet.fit(sector.name, left + 10, top + 21, labelWidth - 20, 34, 13, 9, "#ffffff");
        const nameLeft = left + labelWidth + 13, nameWidth = width - labelWidth - closureWidth - 26;
        sheet.rect(left + labelWidth, top, width - labelWidth - closureWidth, 4, sector.hex);
        sheet.text(`SANT'EGIDIO | CERIMONIA FINALE | ${ceremonyDate.toUpperCase()}`, nameLeft, top + 8, 7, "#455468");
        sheet.fit(person.name, nameLeft, top + 20, nameWidth, 29, 21, 9, "#182230");
        if (person.groupName) sheet.fit(person.groupName, nameLeft, top + 50, nameWidth, 10, 7, 5, "#455468");
        const closureLeft = left + width - closureWidth;
        sheet.rect(closureLeft, top, closureWidth, height, "#f2f4f7");
        sheet.rect(closureLeft, top, closureWidth, 4, sector.hex);
        sheet.outline(left, top, width, height, closureLeft);
      }
      sheet.text(`Aggiornato al ${snapshotLabel} (Roma)`, left, 574, 7, "#455468");
      const pageLabel = `${page + 1} / ${pages}`;
      doc.fontSize(7);
      sheet.text(pageLabel, left + width - doc.widthOfString(pageLabel), 574, 7, "#455468");
      if (previews) attachments.push({ filename: `riepilogo-${sector.color.toLowerCase()}-${page + 1}.png`,
        contentType: "image/png", cid: `closing-leader-${sector.code}-${page + 1}@iscrizioni-pace`, content: await sheet.image(Math.min(perPage, people.length - page * perPage)) });
    }
    doc.end();
    attachments.push({ filename: `cerimonia-finale-badge-${sector.color.toLowerCase()}.pdf`, contentType: "application/pdf", content: await result });
  }
  return attachments;
}
