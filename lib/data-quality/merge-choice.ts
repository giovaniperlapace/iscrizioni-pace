import type { QualityPerson } from "./data.server.ts";

// A suggestion only: the operator confirms it and the SQL RPC checks all dependencies.
export function suggestedMergeSurvivor(
  left: QualityPerson,
  right: QualityPerson,
): string {
  if (left.authUserId && right.authUserId) return "";
  if (left.authUserId) return left.id;
  if (right.authUserId) return right.id;
  const leftTime = Date.parse(left.submittedAt ?? "");
  const rightTime = Date.parse(right.submittedAt ?? "");
  if (
    !Number.isFinite(leftTime) ||
    !Number.isFinite(rightTime) ||
    leftTime === rightTime
  )
    return "";
  return leftTime > rightTime ? left.id : right.id;
}
