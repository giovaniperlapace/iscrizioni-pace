export type GroupTreeNode = { id: string; parentGroupId: string | null };

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

export function normalizeLeaderInternalNote(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, " ");

  return normalized.length > 0 ? normalized.slice(0, 800) : null;
}
