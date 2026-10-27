import { leaderSectorSubjects, type LeaderTickets } from "./leader-tickets.ts";
import { subjectKey, type LeaderBatchCommand } from "./sector-desk.ts";

// A ceremony-wide revision also changes for unrelated groups. Retry only when
// the confirmed allocation and every selected person are still unchanged.
// Call exclusively after a definitive `conflict`, never an uncertain response.
export function rebaseLeaderBatch(
  command: LeaderBatchCommand,
  previous: LeaderTickets,
  current: LeaderTickets,
  requestId: string,
): LeaderBatchCommand | null {
  const before = previous.allocations.find((a) => a.id === command.allocationId);
  const after = current.allocations.find((a) => a.id === command.allocationId);
  if (
    !before || !after || before.revision !== command.revision ||
    !Number.isInteger(after.revision) || after.revision <= command.revision ||
    after.revision > 2147483646 || after.state !== "validated" || after.numbered
  ) return null;
  const fields = [
    "planId", "kind", "state", "groupId", "groupName", "sector", "badgeCode",
    "category", "location", "startsAt", "quantity", "used", "numbered",
  ] as const;
  if (fields.some((key) => before[key] !== after[key])) return null;
  if (!command.subjects.length || command.subjects.length > after.quantity - after.used)
    return null;
  const oldSubjects = new Map(leaderSectorSubjects(previous, before).map((s) => [subjectKey(s), s]));
  const newSubjects = new Map(leaderSectorSubjects(current, after).map((s) => [subjectKey(s), s]));
  if (new Set(command.subjects.map(subjectKey)).size !== command.subjects.length)
    return null;
  for (const subject of command.subjects) {
    const old = oldSubjects.get(subjectKey(subject));
    const fresh = newSubjects.get(subjectKey(subject));
    if (!old || !fresh || !old.eligible || !fresh.eligible || old.assigned || fresh.assigned ||
      old.name !== fresh.name || old.parent !== fresh.parent || old.code !== fresh.code)
      return null;
  }
  return { ...command, revision: after.revision, requestId };
}
