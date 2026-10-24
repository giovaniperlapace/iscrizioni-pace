import { isMapId } from "./seat-map.ts";
import {
  parseDeskCommand,
  type DeskCommand,
  type SeatsDesk,
} from "./seats-desk.ts";

export type CeremonyDraft = {
  action?: "assign_direct" | "group" | "group_nominal";
  id: string;
  sectorId: string;
  sector: string;
  quantity: number;
  groupId: string | null;
  groupName: string | null;
  subjects: { registrationId: string; childId: string | null; name: string }[];
};
export type DraftCommand = {
  planId: string;
  revision: number;
  requestId: string;
  operation: "save" | "remove" | "publish";
  draftId: string | null;
  data: DeskCommand["data"] | null;
};
export type DraftResult = {
  status: string;
  seats?: number;
  notifications?: number;
  missingGroups?: number;
};
export function parseDraftCommand(input: unknown): DraftCommand | null {
  if (!input || typeof input !== "object") return null;
  const c = input as DraftCommand;
  if (
    !isMapId(c.planId) ||
    !isMapId(c.requestId) ||
    !Number.isInteger(c.revision) ||
    c.revision < 0 ||
    c.revision >= 2147483647 ||
    (c.draftId !== null && !isMapId(c.draftId))
  )
    return null;
  if (c.operation === "save")
    return parseDeskCommand(c) &&
      c.data &&
      ["assign_direct", "group", "group_nominal"].includes(c.data.action) &&
      !c.data.seatIds.length
      ? c
      : null;
  if (c.operation === "remove") return c.draftId && c.data === null ? c : null;
  return c.operation === "publish" && c.draftId === null && c.data === null
    ? c
    : null;
}
export function draftData(
  draft: CeremonyDraft,
  sectorId = draft.sectorId,
  quantity = draft.quantity,
): DeskCommand["data"] {
  return {
    action: draft.action ?? (draft.groupId ? "group" : "assign_direct"),
    sectorId,
    quantity,
    groupId: draft.groupId,
    seatIds: [],
    subjects: draft.subjects.map(({ registrationId, childId }) => ({
      registrationId,
      childId,
    })),
  };
}
export function sectorCounts(desk: SeatsDesk, sectorId: string) {
  const allocations = desk.allocations.filter((a) => a.sectorId === sectorId);
  const ids = new Set(allocations.map((a) => a.id));
  const nominal = desk.nominees.filter(
    (n) => ids.has(n.allocationId) && n.needsSeat,
  ).length;
  const published = allocations.reduce((total, a) => total + a.quantity, 0);
  const draft = (desk.drafts ?? [])
    .filter((d) => d.sectorId === sectorId)
    .reduce((total, d) => total + d.quantity, 0);
  return { nominal, groupPending: Math.max(0, published - nominal), draft };
}
