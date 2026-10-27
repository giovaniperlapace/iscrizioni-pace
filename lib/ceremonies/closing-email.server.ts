import { createCampaignBadge } from "../email/campaign-badge.server.ts";
import { closingBadgeSector } from "./closing-badges.ts";
import { renderClosingBadgeEmail } from "./closing-email.ts";
import type { PublicationNotice } from "./publication-email.ts";
import type { SendEmailInput } from "../email/smtp.ts";
import { createClosingLeaderBadgeAttachments } from "./closing-leader-badges.server.ts";

const MAX_ATTACHMENT_BYTES = 6 * 1024 * 1024;
type Attachments = NonNullable<SendEmailInput["attachments"]>;
const attachmentBytes = (files: Attachments) => files.reduce((sum, file) => sum + file.content.length, 0);

export async function prepareClosingBadgeEmail(notice: PublicationNotice, appUrl: string) {
  const attachments: Attachments = [];
  if (notice.payload.noticeType === "leader_contacts") attachments.push(...await createClosingLeaderBadgeAttachments(notice));
  if (!notice.userId) {
    let personal = await personalBadgeAttachments(notice, 95);
    if (attachmentBytes(attachments) + attachmentBytes(personal) > MAX_ATTACHMENT_BYTES) {
      // Keep every family member and the original dimensions; regenerate from the PNG,
      // with the same JPEG embedded in the PDF. Ordinary messages retain quality 95.
      personal = await personalBadgeAttachments(notice, 85);
    }
    attachments.push(...personal);
  }
  if (attachmentBytes(attachments) > MAX_ATTACHMENT_BYTES) throw Error("closing_badges_too_large");
  const previews = attachments.filter(file => file.contentType === "image/png" && file.cid)
    .map(file => ({ cid: file.cid! }));
  return { ...renderClosingBadgeEmail(notice, appUrl, previews), attachments };
}

async function personalBadgeAttachments(notice: PublicationNotice, jpegQuality: 95 | 85): Promise<Attachments> {
  const attachments: Attachments = [];
  const seen = new Set<string>();
  for (const [index, line] of notice.payload.lines.entries()) {
    const sector = closingBadgeSector(line.badgeCode);
    if (!sector || !line.nomineeId || seen.has(line.nomineeId)) throw Error("invalid_badge_identity");
    seen.add(line.nomineeId);
    const badge = await createCampaignBadge({ firstName: line.name, lastName: "", groupName: "" }, sector.template, { jpegQuality });
    const cid = `closing-badge-${index}@iscrizioni-pace`;
    // Unique attachment names/CIDs for families, even when all have the same color.
    attachments.push({ ...badge.pdf, filename: `badge-${index + 1}-${sector.template}.pdf` }, { ...badge.image, cid, filename: `badge-${index + 1}.jpg` });
  }
  return attachments;
}
