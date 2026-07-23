export const MAX_CAMPAIGN_RECIPIENTS = 100;

export function resolveSelectedCampaignRecipientIds(
  availableRecipientIds: Iterable<string>,
  requestedRecipientIds: Iterable<string>
): Set<string> {
  const availableIds = new Set(availableRecipientIds);
  const selectedIds = new Set(
    [...requestedRecipientIds].filter((id) => availableIds.has(id))
  );

  if (!selectedIds.size) {
    throw new Error("Seleziona almeno un destinatario.");
  }

  if (selectedIds.size > MAX_CAMPAIGN_RECIPIENTS) {
    throw new Error(
      `Puoi selezionare al massimo ${MAX_CAMPAIGN_RECIPIENTS} destinatari.`
    );
  }

  return selectedIds;
}
