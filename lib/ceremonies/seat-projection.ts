import { ceremonySeatLabel } from "./seat-label.ts";
import { closingBadgeSector } from "./closing-badges.ts";
export type CeremonySeatInfo = {
  badgeCode?: string | null;
  kind: "opening" | "closing";
  sector: string;
  needsSeat: boolean;
  review: boolean;
  seat: { id: string; row: string; number: string; mapVersion: number } | null;
};
// Absence is allowed for older fixtures. A malformed supplied projection fails closed.
export function parseCeremonySeatInfo(
  input: unknown,
): CeremonySeatInfo[] | null {
  if (input === undefined) return [];
  if (!Array.isArray(input) || input.length > 2) return null;
  const result: CeremonySeatInfo[] = [];
  for (const x of input) {
    if (
      !x ||
      !["opening", "closing"].includes(x.kind) ||
      typeof x.sector !== "string" ||
      typeof x.needsSeat !== "boolean" ||
      typeof x.review !== "boolean" ||
      (x.badgeCode != null && (x.kind !== "closing" || !closingBadgeSector(x.badgeCode))) ||
      (x.seat !== null &&
        (!x.seat ||
          typeof x.seat.id !== "string" ||
          typeof x.seat.row !== "string" ||
          typeof x.seat.number !== "string" ||
          !Number.isSafeInteger(x.seat.mapVersion)))
    )
      return null;
    result.push({
      kind: x.kind,
      sector: x.sector,
      needsSeat: x.needsSeat,
      review: x.review,
      ...(x.badgeCode ? { badgeCode: x.badgeCode } : {}),
      seat:
        x.seat === null
          ? null
          : {
              id: x.seat.id,
              row: x.seat.row,
              number: x.seat.number,
              mapVersion: x.seat.mapVersion,
            },
    });
  }
  return result;
}
export function ceremonySeatText(s: CeremonySeatInfo): string {
  const badge = s.kind === "closing" && s.needsSeat ? closingBadgeSector(s.badgeCode) : null;
  if (badge) return `Cerimonia finale · ${s.sector} · Badge ${badge.color}${s.review ? " · Da rivedere" : ""}`;
  return `${s.kind === "opening" ? "Inaugurazione" : "Cerimonia finale"} · ${s.needsSeat && s.seat ? ceremonySeatLabel(s.sector, s.seat) : `Settore ${s.sector} · ${s.needsSeat ? "Posto nel settore" : "Non serve un posto"}`}${s.review ? " · Da rivedere" : ""}`;
}
