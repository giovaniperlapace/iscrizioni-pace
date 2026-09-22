export type GroupDeletionPreview = {
  name: string; expected: string; children: number; assignments: number; currentAssignments: number;
  memberships: number; links: number; rules: number;
};
export type GroupDeletionError = "forbidden" | "conflict" | "missing" | "children" | "failed";
export type GroupDeletionResult = { preview: GroupDeletionPreview } | { deleted: true } | { error: GroupDeletionError };
