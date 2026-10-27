import PDFDocument from "pdfkit";
import sharp from "sharp";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { CAMPAIGN_BADGE_TEMPLATE, CAMPAIGN_BADGE_TEMPLATES, campaignBadgeTemplates, type CampaignBadgeTemplate } from "./campaign-badge.ts";
import type { CampaignTemplateData } from "./campaign-templates.ts";

type Attachment = { filename: string; content: Buffer; contentType: string; cid?: string; inline: boolean };
type BadgeIdentity = Pick<CampaignTemplateData, "firstName" | "lastName" | "groupName">;
type BadgeImageOptions = { jpegQuality?: 95 | 85 };
// Immutable version: retain this asset for queued campaigns and explicit retries.
const backgrounds = new Map<CampaignBadgeTemplate, Promise<Buffer>>();
const font = path.join(process.cwd(), "lib/qrcode/fonts/NotoSans-Regular.ttf");

export async function createCampaignBadgeImage(data: BadgeIdentity, templateId: CampaignBadgeTemplate = CAMPAIGN_BADGE_TEMPLATE, options: BadgeImageOptions = {}) {
  const name = `${data.firstName} ${data.lastName}`.replace(/\s+/g, " ").trim();
  const group = data.groupName?.replace(/\s+/g, " ").trim() ?? "";
  if (!name) throw new Error("Nome del partecipante mancante per il badge.");
  if (name.length > 1000 || group.length > 1000) throw new Error("Testo troppo lungo per il badge.");
  const template = CAMPAIGN_BADGE_TEMPLATES.find(item => item.id === templateId);
  if (!template) throw new Error("Modello badge non disponibile.");
  let background = backgrounds.get(templateId);
  if (!background) {
    background = readFile(path.join(process.cwd(), `lib/email/assets/${template.id}.png`))
      .catch(cause => { backgrounds.delete(templateId); throw cause; });
    backgrounds.set(templateId, background);
  }
  const layers: sharp.OverlayOptions[] = [];
  const fitText = async (text: string, top: number, height: number, maxSize: number) => {
    if (!text) return;
    // Pango markup must not interpret participant names or group names as tags.
    const escaped = text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    for (let size = maxSize; size >= 16; size -= 2) {
      const rendered = await sharp({ text: { text: `<span foreground="#251136">${escaped}</span>`,
        font: `Noto Sans ${size}`, fontfile: font, width: 826, align: "centre", wrap: "word-char", rgba: true, dpi: 72,
      } }).png().toBuffer({ resolveWithObject: true });
      if (rendered.info.height > height || rendered.info.width > 826) continue;
      layers.push({ input: rendered.data, left: Math.round((941 - rendered.info.width) / 2),
        top: top + Math.round((height - rendered.info.height) / 2) });
      return;
    }
    throw new Error("Testo troppo lungo per il badge.");
  };
  await fitText(name, 1237, 220, 80);
  await fitText(group, 1490, 123, 43);
  const jpeg = await sharp(await background).composite(layers).jpeg({ quality: options.jpegQuality ?? 95, chromaSubsampling: "4:4:4" }).toBuffer();
  return { jpeg, template };
}

export async function createCampaignBadge(data: BadgeIdentity, templateId: CampaignBadgeTemplate = CAMPAIGN_BADGE_TEMPLATE, options: BadgeImageOptions = {}): Promise<{ pdf: Attachment; image: Attachment }> {
  const { jpeg, template } = await createCampaignBadgeImage(data, templateId, options);
  // The PDF embeds the exact image shown in the message, at the original aspect ratio.
  const doc = new PDFDocument({ size: [282.3, 501.6], margin: 0, font,
    info: { Title: `Badge ${template.title}`, CreationDate: new Date("2026-10-26T00:00:00Z") } });
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", chunk => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  doc.image(jpeg, 0, 0, { width: 282.3, height: 501.6 });
  doc.end();
  return {
    pdf: { filename: `${template.fileStem}.pdf`, content: await result, contentType: "application/pdf", inline: false },
    image: { filename: `${template.fileStem}.jpg`, content: jpeg, contentType: "image/jpeg", inline: true, cid: template.cid },
  };
}

export async function campaignAttachmentsForRecipient(
  common: Attachment[], snapshot: unknown, data: BadgeIdentity
): Promise<Attachment[]> {
  const templates = campaignBadgeTemplates(snapshot);
  if (!templates.length) return common;
  const attachments = [...common];
  for (const templateId of templates) {
    const badge = await createCampaignBadge(data, templateId);
    attachments.push(badge.pdf, badge.image);
  }
  // Leave space for base64 encoding and the message below the transport's 9 MB cap.
  if (attachments.reduce((sum, attachment) => sum + attachment.content.length, 0) > 6 * 1024 * 1024) {
    throw new Error("Con il badge gli allegati non possono superare complessivamente 6 MB.");
  }
  return attachments;
}

export async function campaignBadgePreviews(snapshot: unknown, data: BadgeIdentity, commonBytes = 0) {
  const templates = campaignBadgeTemplates(snapshot);
  const attachments = await campaignAttachmentsForRecipient([], snapshot, data);
  if (templates.length && commonBytes + attachments.reduce((sum, attachment) => sum + attachment.content.length, 0) > 6 * 1024 * 1024) {
    throw new Error("Con il badge gli allegati non possono superare complessivamente 6 MB.");
  }
  return templates.map((templateId, index) => {
    const pdf = attachments[index * 2];
    const image = attachments[index * 2 + 1];
    const template = CAMPAIGN_BADGE_TEMPLATES.find(item => item.id === templateId)!;
    return { templateId, label: template.label, fileName: pdf.filename, sizeBytes: pdf.content.length,
      pdfBase64: pdf.content.toString("base64"), imageBase64: image.content.toString("base64") };
  });
}
