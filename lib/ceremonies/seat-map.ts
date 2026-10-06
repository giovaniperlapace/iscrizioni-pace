import type { CeremonyKind } from "./contracts.ts";
import type { DistributionAllocation, Nominee } from "./distribution.ts";
export type MapSeat = {
  id: string;
  sectorId: string;
  row: string;
  number: string;
  x: number;
  y: number;
  blocked: boolean;
};
export type MapVersion = {
  id: string;
  version: number;
  title: string;
  seats: MapSeat[];
};
export type SeatMapView = {
  planId: string;
  revision: number;
  kind: CeremonyKind;
  state: "draft" | "validated";
  active: MapVersion | null;
  draft: MapVersion | null;
  history: MapVersion[];
  sectors: { id: string; name: string; capacity: number | null }[];
  allocations: (DistributionAllocation & { sectorId: string })[];
  nominees: Nominee[];
  claims: {
    seatId: string;
    allocationId: string | null;
    nomineeId: string | null;
  }[];
};
export type SeatMapCommand = {
  planId: string;
  revision: number;
  requestId: string;
} & (
  | { operation: "draft"; data: { title: string; seats: MapSeat[] } }
  | { operation: "publish"; data: { versionId: string } }
  | {
      operation: "reserve" | "release" | "name" | "unname";
      data: { allocationId: string; seatIds: string[]; nomineeId?: string };
    }
);
export const isMapId = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const keys = (v: object, allowed: string[]) =>
  Object.keys(v).every((k) => allowed.includes(k));
export function validMapSeats(value: unknown): value is MapSeat[] {
  if (!Array.isArray(value) || value.length > 10000) return false;
  const ids = new Set<string>(),
    labels = new Set<string>();
  return value.every((s) => {
    if (
      !s ||
      typeof s !== "object" ||
      !keys(s, ["id", "sectorId", "row", "number", "x", "y", "blocked"]) ||
      !isMapId(s.id) ||
      !isMapId(s.sectorId) ||
      typeof s.blocked !== "boolean" ||
      ![s.row, s.number].every(
        (x) => typeof x === "string" && x.trim().length > 0 && x.length <= 30,
      ) ||
      ![s.x, s.y].every(
        (x) =>
          typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 10000,
      )
    )
      return false;
    const label = JSON.stringify([
      s.sectorId,
      s.row.trim().toLowerCase(),
      s.number.trim().toLowerCase(),
    ]);
    if (ids.has(s.id) || labels.has(label)) return false;
    ids.add(s.id);
    labels.add(label);
    return true;
  });
}
export function parseSeatMapCommand(input: unknown): SeatMapCommand | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const c = input as SeatMapCommand;
  if (
    !keys(c, ["planId", "revision", "requestId", "operation", "data"]) ||
    !isMapId(c.planId) ||
    !isMapId(c.requestId) ||
    !Number.isInteger(c.revision) ||
    c.revision < 0 ||
    c.revision > 2147483646 ||
    !c.data ||
    typeof c.data !== "object" ||
    Array.isArray(c.data)
  )
    return null;
  if (c.operation === "draft")
    return keys(c.data, ["title", "seats"]) &&
      typeof c.data.title === "string" &&
      c.data.title.trim().length > 0 &&
      c.data.title.length <= 100 &&
      validMapSeats(c.data.seats)
      ? c
      : null;
  if (c.operation === "publish")
    return keys(c.data, ["versionId"]) && isMapId(c.data.versionId) ? c : null;
  if (
    !["reserve", "release", "name", "unname"].includes(c.operation) ||
    !("seatIds" in c.data)
  )
    return null;
  const d = c.data;
  if (
    !keys(d, ["allocationId", "seatIds", "nomineeId"]) ||
    !isMapId(d.allocationId) ||
    !Array.isArray(d.seatIds) ||
    !d.seatIds.length ||
    d.seatIds.length > 10000 ||
    !d.seatIds.every(isMapId) ||
    new Set(d.seatIds).size !== d.seatIds.length
  )
    return null;
  return (
    c.operation === "name"
      ? d.seatIds.length === 1 && isMapId(d.nomineeId)
      : d.nomineeId === undefined
  )
    ? c
    : null;
}
// Contiguity is explicit row order (numeric labels), never guessed from proximity.
export function contiguousSeats(
  seats: MapSeat[],
  available: Set<string>,
  count: number,
): string[] {
  if (!Number.isInteger(count) || count < 1) return [];
  const rows = new Map<string, MapSeat[]>();
  for (const s of seats) {
    const k = JSON.stringify([s.sectorId, s.row]);
    if (!rows.has(k)) rows.set(k, []);
    rows.get(k)!.push(s);
  }
  for (const row of rows.values()) {
    row.sort((a, b) => Number(a.number) - Number(b.number));
    let run: MapSeat[] = [];
    for (const s of row) {
      if (!/^\d+$/.test(s.number) || s.blocked || !available.has(s.id)) {
        run = [];
        continue;
      }
      if (run.length && Number(s.number) !== Number(run.at(-1)!.number) + 1)
        run = [];
      run.push(s);
      if (run.length === count) return run.map((x) => x.id);
    }
  }
  return [];
}
