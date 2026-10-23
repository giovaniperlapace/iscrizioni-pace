import { isMapId } from "./seat-map.ts";
import {
  eligibleSubjects,
  type DistributionView,
  type DistributionAllocation,
} from "./distribution.ts";
export type LeaderTickets = Omit<DistributionView, "allocations"> & {
  allocations: (DistributionView["allocations"][number] & {
    numbered: boolean;
  })[];
  tickets: {
    allocationId: string;
    nomineeId: string | null;
    seat: { id: string; row: string; number: string };
  }[];
};
export type PairTicketCommand = {
  action: "assign" | "revoke" | "no_seat";
  allocationId: string;
  revision: number;
  requestId: string;
  seatId: string | null;
  registrationId: string | null;
  childId: string | null;
  nomineeId: string | null;
};
export function parsePairTicketCommand(
  input: unknown,
): PairTicketCommand | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const c = input as PairTicketCommand;
  if (
    Object.keys(c).some(
      (k) =>
        ![
          "action",
          "allocationId",
          "revision",
          "requestId",
          "seatId",
          "registrationId",
          "childId",
          "nomineeId",
        ].includes(k),
    ) ||
    !["assign", "revoke", "no_seat"].includes(c.action) ||
    !isMapId(c.allocationId) ||
    !isMapId(c.requestId) ||
    !Number.isInteger(c.revision) ||
    c.revision < 0 ||
    c.revision > 2147483646
  )
    return null;
  for (const k of ["seatId", "registrationId", "childId", "nomineeId"] as const)
    if (c[k] !== null && !isMapId(c[k])) return null;
  if (c.action === "revoke")
    return c.nomineeId &&
      c.seatId === null &&
      c.registrationId === null &&
      c.childId === null
      ? c
      : null;
  if (
    !c.registrationId ||
    c.nomineeId !== null ||
    (c.action === "no_seat" && (!c.childId || c.seatId !== null))
  )
    return null;
  return c;
}

// Attendance is already scoped by the canonical RPC to this ceremony's Rome
// day and time slot. Stable sorting keeps surname/family order within each tier.
export function leaderSectorSubjects(
  view: DistributionView,
  allocation: DistributionAllocation,
) {
  const choices = new Map(
    view.people.map((person) => [
      person.registrationId,
      person.attendance?.find((a) => a.planId === allocation.planId)?.choice ??
        "unknown",
    ]),
  );
  return eligibleSubjects(view, allocation)
    .map((subject) => ({
      ...subject,
      attendance: choices.get(subject.registrationId) ?? "unknown",
    }))
    .sort(
      (a, b) => Number(b.attendance === "yes") - Number(a.attendance === "yes"),
    );
}
