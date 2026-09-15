export type GroupLeaderSummary = {
  userId: string;
  name: string;
  isPrimary: boolean;
};

type RoleUser = {
  userId: string;
  fullName: string | null;
  email: string | null;
  assignments: Array<{
    role: string;
    groupId: string | null;
    eventId: string | null;
    isPrimaryGroupLeader: boolean | null;
  }>;
};

export function groupLeaderSummaries(users: RoleUser[], groupId: string, eventId: string): GroupLeaderSummary[] {
  const leaders = new Map<string, GroupLeaderSummary>();
  for (const user of users) {
    for (const assignment of user.assignments) {
      if (assignment.role !== "capogruppo" || assignment.groupId !== groupId || assignment.eventId !== eventId) continue;
      const previous = leaders.get(user.userId);
      leaders.set(user.userId, {
        userId: user.userId,
        name: user.fullName?.trim() || user.email?.trim() || "Nome non disponibile",
        isPrimary: Boolean(previous?.isPrimary || assignment.isPrimaryGroupLeader),
      });
    }
  }
  return [...leaders.values()].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.name.localeCompare(b.name, "it"));
}
