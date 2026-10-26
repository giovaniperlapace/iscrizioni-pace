import { createCampaignBadge } from "../email/campaign-badge.server.ts";
import { closingBadgeSector } from "./closing-badges.ts";
import { renderClosingBadgeEmail } from "./closing-email.ts";
import type { PublicationNotice } from "./publication-email.ts";
import type { SendEmailInput } from "../email/smtp.ts";
import { createClosingLeaderBadgePdfs } from "./closing-leader-badges.server.ts";

export async function prepareClosingBadgeEmail(notice: PublicationNotice, appUrl: string) {
  const message = renderClosingBadgeEmail(notice, appUrl);
  const attachments: NonNullable<SendEmailInput["attachments"]> = [];
  if (notice.payload.noticeType === "leader_contacts") attachments.push(...await createClosingLeaderBadgePdfs(notice));
  if (!notice.userId) {
    const seen = new Set<string>();
    for (const [index, line] of notice.payload.lines.entries()) {
      const sector = closingBadgeSector(line.badgeCode);
      if (!sector || !line.nomineeId || seen.has(line.nomineeId)) throw Error("invalid_badge_identity");
      seen.add(line.nomineeId);
      const badge = await createCampaignBadge({ firstName: line.name, lastName: "", groupName: "" }, sector.template);
      const cid = `closing-badge-${index}@iscrizioni-pace`;
      // Unique attachment names/CIDs for families, even when all have the same color.
      attachments.push({ ...badge.pdf, filename: `badge-${index + 1}-${sector.template}.pdf` }, { ...badge.image, cid, filename: `badge-${index + 1}.jpg` });
    }
  }
  if (attachments.reduce((sum, file) => sum + file.content.length, 0) > 6 * 1024 * 1024) throw Error("closing_badges_too_large");
  return { ...message, attachments };
}
