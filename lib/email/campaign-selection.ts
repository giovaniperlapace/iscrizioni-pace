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

  return selectedIds;
}
