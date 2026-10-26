// Keep the displayed example and the test email on the same selected person,
// independently of query ordering or randomly generated recipient row IDs.
export function selectCampaignSample<T extends { recipientKey: string }>(recipients: T[], selected?: Set<string>): T | undefined {
  return recipients.filter(recipient => !selected || selected.has(recipient.recipientKey))
    .sort((a, b) => a.recipientKey < b.recipientKey ? -1 : a.recipientKey > b.recipientKey ? 1 : 0)[0];
}

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
