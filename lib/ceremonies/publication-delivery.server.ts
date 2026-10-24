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
      return {
        to,
        ...renderPublicationEmail(notice, appUrl),
        metadata: { ceremony_email_id: notice.id },
      };
    },
  );
}
