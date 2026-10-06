export type CeremonySeatInfo = {
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
  return `${s.kind === "opening" ? "Inaugurazione" : "Cerimonia finale"} · ${s.sector} · ${!s.needsSeat ? "Non serve un posto" : s.seat ? `Fila ${s.seat.row} · Posto ${s.seat.number}` : "Seduta da assegnare"}${s.review ? " · Da rivedere" : ""}`;
}
