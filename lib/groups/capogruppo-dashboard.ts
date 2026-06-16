export type GroupLeaderAssignmentStatus = "probable" | "confirmed" | "rejected";

export type GroupLeaderReviewFilter =
  | "all"
  | "to-review"
  | "probable"
  | "confirmed"
  | "rejected";

export type GroupTreeNode = {
  id: string;
  parentGroupId: string | null;
};

export type GroupLeaderAssignmentSummaryInput = {
  status: string | null;
  isCurrent: boolean;
  leaderNotificationReadAt: string | null;
};

export type GroupLeaderAssignmentSummary = {
  total: number;
  toReview: number;
  probable: number;
  confirmed: number;
  rejected: number;
};

export const GROUP_LEADER_REVIEW_FILTERS: GroupLeaderReviewFilter[] = [
  "all",
  "to-review",
  "probable",
  "confirmed",
  "rejected",
];

export function parseGroupLeaderReviewFilter(
  value: string | null | undefined
): GroupLeaderReviewFilter {
  return GROUP_LEADER_REVIEW_FILTERS.includes(value as GroupLeaderReviewFilter)
    ? (value as GroupLeaderReviewFilter)
    : "to-review";
}

export function collectDescendantGroupIds(
  nodes: GroupTreeNode[],
  rootIds: string[]
): Set<string> {
  const childrenByParentId = new Map<string, string[]>();

  for (const node of nodes) {
    if (!node.parentGroupId) {
      continue;
    }

    const children = childrenByParentId.get(node.parentGroupId) ?? [];
    children.push(node.id);
    childrenByParentId.set(node.parentGroupId, children);
  }

  const result = new Set<string>();
  const queue = [...rootIds];

  while (queue.length > 0) {
    const groupId = queue.shift();

    if (!groupId || result.has(groupId)) {
      continue;
    }

    result.add(groupId);
    queue.push(...(childrenByParentId.get(groupId) ?? []));
  }

  return result;
}

export function getEscalationTargetGroupId(
  groupsById: Map<string, GroupTreeNode>,
  groupId: string
): string | null {
  return groupsById.get(groupId)?.parentGroupId ?? null;
}

export function summarizeGroupLeaderAssignments(
  assignments: GroupLeaderAssignmentSummaryInput[]
): GroupLeaderAssignmentSummary {
  return assignments.reduce<GroupLeaderAssignmentSummary>(
    (summary, assignment) => {
      summary.total += 1;

      if (assignment.status === "probable" && assignment.isCurrent) {
        summary.probable += 1;
      }

      if (assignment.status === "confirmed" && assignment.isCurrent) {
        summary.confirmed += 1;
      }

      if (assignment.status === "rejected") {
        summary.rejected += 1;
      }

      if (needsGroupLeaderReview(assignment)) {
        summary.toReview += 1;
      }

      return summary;
    },
    {
      total: 0,
      toReview: 0,
      probable: 0,
      confirmed: 0,
      rejected: 0,
    }
  );
}

export function matchesGroupLeaderFilter(
  assignment: GroupLeaderAssignmentSummaryInput,
  filter: GroupLeaderReviewFilter
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "to-review":
      return needsGroupLeaderReview(assignment);
    case "probable":
      return assignment.status === "probable" && assignment.isCurrent;
    case "confirmed":
      return assignment.status === "confirmed" && assignment.isCurrent;
    case "rejected":
      return assignment.status === "rejected";
  }
}

export function needsGroupLeaderReview(
  assignment: GroupLeaderAssignmentSummaryInput
): boolean {
  return (
    assignment.isCurrent &&
    assignment.status === "probable" &&
    !assignment.leaderNotificationReadAt
  );
}

export function normalizeLeaderInternalNote(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, " ");

  return normalized.length > 0 ? normalized.slice(0, 800) : null;
}
