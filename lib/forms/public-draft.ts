// Upgrade previous browser drafts without discarding identity, contacts or choices.
// Retired sensitive values must also be removed from drafts for other addresses.
export function migratePublicRegistrationDrafts(storage: Storage) {
  const legacyPrefix = "iscrizioni-pace.registration-form:";
  const currentPrefix = "iscrizioni-pace.registration-form-v2:";
  for (const key of Object.keys(storage)) {
    if (!key.startsWith(legacyPrefix)) continue;
    try {
      const draft = JSON.parse(storage.getItem(key) ?? "null");
      if (draft?.fields) delete draft.fields.accessibilityNotes;
      const destination = `${currentPrefix}${key.slice(legacyPrefix.length)}`;
      const current = JSON.parse(storage.getItem(destination) ?? "null");
      storage.removeItem(key);
      if (draft && (!current || current.savedAt < draft.savedAt)) {
        storage.setItem(destination, JSON.stringify(draft));
      }
    } catch {
      storage.removeItem(key);
    }
  }
}
