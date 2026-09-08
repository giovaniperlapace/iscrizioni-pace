// The actor is recorded by the server, never taken from a submitted email/user ID.
export function explicitParticipantDelegate(
  registration: { source: string; created_by: string | null },
  answers: unknown,
): { explicit: boolean; userId: string | null } {
  const contact = answers && typeof answers === "object" && "contact" in answers
    ? answers.contact : null;
  if (!contact || typeof contact !== "object" || !("useLeaderEmail" in contact)
    || contact.useLeaderEmail !== true) return { explicit: false, userId: null };
  const delegate = "communicationDelegateUserId" in contact
    ? contact.communicationDelegateUserId : null;
  return {
    explicit: true,
    userId: registration.source === "capogruppo" && delegate === registration.created_by
      ? registration.created_by : null,
  };
}

export function groupAndAncestorIds(
  groupId: string,
  groups: Map<string, { parent_group_id: string | null }>,
): string[] {
  const ids: string[] = [];
  let current: string | null = groupId;
  while (current && groups.has(current) && !ids.includes(current)) {
    ids.push(current);
    current = groups.get(current)!.parent_group_id;
  }
  return ids;
}

export function chooseParticipantDelegate(
  explicit: { explicit: boolean; userId: string | null },
  eligibleLeaderIds: string[],
): string | null {
  return explicit.explicit
    ? explicit.userId && eligibleLeaderIds.includes(explicit.userId) ? explicit.userId : null
    : eligibleLeaderIds[0] ?? null;
}
