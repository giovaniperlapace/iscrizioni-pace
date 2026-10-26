import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  resolveCurrentParticipantRecipient,
  loadCampaignRecipientPreviews,
} from "@/lib/email/campaign-recipients.server";
import { getOperationalUserIdentities } from "@/lib/operational-users/identity";
import {
  renderPublicationEmail,
  type PublicationNotice,
} from "./publication-email";
import { processCeremonyPublicationEmails } from "./publication-delivery";

export async function processDueCeremonyPublications() {
  const db = createSupabaseServiceClient();
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  if (!["https:", "http:"].includes(new URL(appUrl).protocol))
    throw Error("ceremony_email_site_url_missing");
  return processCeremonyPublicationEmails(
    db,
    async (notice: PublicationNotice) => {
      let to: string | undefined;
      if (notice.userId) {
        const identities = await getOperationalUserIdentities(db, [
          notice.userId,
        ]);
        to = identities.get(notice.userId)?.email ?? undefined;
      } else if (notice.payload.badgeWorkflow) {
        // The atomic claim resolves the current personal contact and aggregates missing
        // contacts into one leader report. Never send one delegated email per person.
        to = notice.destinationEmail ?? undefined;
      } else if (notice.registrationId) {
        // Same current contact/delegation rules as individual campaign messages.
        const recipient = await resolveCurrentParticipantRecipient(
          notice.eventId,
          notice.registrationId,
        );
        if (!recipient) throw Error("ceremony_email_contact_missing");
        to = (
          await loadCampaignRecipientPreviews(
            [recipient],
            new Set(),
            notice.eventId,
            false,
          )
        )[0]?.destinationEmail;
      }
      if (!to) throw Error("ceremony_email_contact_missing");
      const message = notice.payload.badgeWorkflow
        ? await (await import("./closing-email.server")).prepareClosingBadgeEmail(notice, appUrl)
        : renderPublicationEmail(notice, appUrl);
      return {
        to,
        ...message,
        metadata: { ceremony_email_id: notice.id },
      };
    },
  );
}
