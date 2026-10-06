import type { CeremonyKind } from "./contracts.ts";
export type DistributionAllocation = {
  id: string;
  planId: string;
  kind: CeremonyKind;
  revision: number;
  state: "draft" | "validated";
  groupId: string | null;
  groupName: string | null;
  location: string;
  startsAt: string;
  sector: string;
  category: string;
  quantity: number;
  used: number;
};
export type Nominee = {
  id: string;
  allocationId: string;
  registrationId: string;
  childId: string | null;
  needsSeat: boolean;
  name: string;
  review: boolean;
};
export type DistributionPerson = {
  registrationId: string;
  name: string;
  code: string;
  groupIds: string[];
  children: { id: string; name: string }[];
  eligiblePlanIds: string[];
  assigned: { planId: string; childId: string | null; needsSeat: boolean }[];
};
export type DistributionView = {
  allocations: DistributionAllocation[];
  nominees: Nominee[];
  people: DistributionPerson[];
};
export type PersonalSeat = {
  seat?: { id: string; row: string; number: string; mapVersion: number } | null;
  mapAvailable?: boolean;
  id: string;
  kind: CeremonyKind;
  name: string;
  child: boolean;
  needsSeat: boolean;
  location: string;
  startsAt: string;
  sector: string;
  category: string;
  review: boolean;
};
export type NomineeCommand = {
  action: "assign" | "revoke" | "move" | "no_seat";
  allocationId: string | null;
  registrationId: string | null;
  childId: string | null;
  nomineeId: string | null;
  revision: number;
  requestId: string;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parseNomineeCommand(value: unknown): NomineeCommand | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const c = value as NomineeCommand;
  if (
    Object.keys(c).some(
      (k) =>
        ![
          "action",
          "allocationId",
          "registrationId",
          "childId",
          "nomineeId",
          "revision",
          "requestId",
        ].includes(k),
    ) ||
    !["assign", "revoke", "move", "no_seat"].includes(c.action) ||
    !Number.isInteger(c.revision) ||
    c.revision < 0 ||
    c.revision > 2147483646 ||
    typeof c.requestId !== "string" ||
    !uuid.test(c.requestId)
  )
    return null;
  for (const key of [
    "allocationId",
    "registrationId",
    "childId",
    "nomineeId",
  ] as const)
    if (c[key] !== null && (typeof c[key] !== "string" || !uuid.test(c[key])))
      return null;
  if (c.action === "assign" || c.action === "no_seat") {
    if (
      !c.allocationId ||
      !c.registrationId ||
      c.nomineeId !== null ||
      (c.action === "no_seat" && !c.childId)
    )
      return null;
  } else if (
    !c.nomineeId ||
    c.registrationId !== null ||
    c.childId !== null ||
    (c.action === "move" ? !c.allocationId : c.allocationId !== null)
  )
    return null;
  return c;
}
export function eligibleSubjects(
  view: DistributionView,
  a: DistributionAllocation,
) {
  return view.people
    .filter((p) => a.groupId !== null && p.groupIds.includes(a.groupId))
    .flatMap((p) => [
      {
        registrationId: p.registrationId,
        childId: null as string | null,
        name: p.name,
        code: p.code,
        parent: null as string | null,
        eligible: p.eligiblePlanIds.includes(a.planId),
        assigned: p.assigned.some(
          (s) => s.planId === a.planId && s.childId === null,
        ),
      },
      ...p.children.map((c) => ({
        registrationId: p.registrationId,
        childId: c.id,
        name: c.name,
        code: p.code,
        parent: p.name,
        eligible: p.eligiblePlanIds.includes(a.planId),
        assigned: p.assigned.some(
          (s) => s.planId === a.planId && s.childId === c.id,
        ),
      })),
    ]);
}
