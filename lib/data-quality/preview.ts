import {
  compareIdentities,
  identityFingerprint,
  type DuplicateMatch,
  type Identity,
} from "./duplicates.ts";
import {
  validateExcelRow,
  type Catalog,
  type ExcelRow,
  type ValidatedRow,
} from "./format.ts";
export type PreviewRow = ValidatedRow & {
  candidates: (DuplicateMatch & {
    name: string;
    fingerprint: string;
    archived?: boolean;
  })[];
};
export type ImportPreview = {
  kind: "import-v1";
  id: string;
  actor: string;
  eventId: string;
  version: string;
  expires: number;
  rows: PreviewRow[];
};
export type RowDecision = {
  row: number;
  action: "import" | "skip";
  reason: string;
};
export function buildPreviewRows(
  input: { row: number; values: ExcelRow; cellErrors: string[] }[],
  catalog: Catalog,
  existing: (Identity & { deletedAt?: string | null })[],
): PreviewRow[] {
  const rows = input.map((item) => {
    const row = validateExcelRow(item.values, item.row, catalog);
    row.errors.push(...item.cellErrors);
    return row;
  });
  return rows.map((row) => ({
    ...row,
    candidates: [
      ...existing,
      ...rows
        .filter((other) => other.row !== row.row)
        .map((other) => other.identity),
    ].flatMap((person) => {
      const match = compareIdentities(row.identity, person);
      const archived = "deletedAt" in person && Boolean(person.deletedAt);
      return match
        ? [
            {
              ...match,
              fingerprint: archived ? "" : identityFingerprint(person),
              name: archived
                ? "Iscrizione archiviata: verifica con un admin"
                : `${person.firstName ?? ""} ${person.lastName ?? ""}${person.id.startsWith("row-") ? ` (riga ${person.id.slice(4)})` : ""}`,
              archived,
            },
          ]
        : [];
    }),
  }));
}
export function validateDecisions(
  rows: PreviewRow[],
  decisions: RowDecision[],
) {
  if (
    !Array.isArray(decisions) ||
    decisions.length !== rows.length ||
    new Set(decisions.map((item) => item.row)).size !== rows.length
  )
    throw new Error("Ogni riga deve avere una scelta esplicita.");
  return rows.map((row) => {
    const decision = decisions.find((item) => item.row === row.row);
    if (!decision || !["import", "skip"].includes(decision.action))
      throw new Error(`Riga ${row.row}: scelta mancante.`);
    const reason =
      typeof decision.reason === "string" ? decision.reason.trim() : "";
    if (decision.action === "import" && row.errors.length)
      throw new Error(`Riga ${row.row}: correggi gli errori o scarta la riga.`);
    if (
      decision.action === "import" &&
      row.candidates.some((match) => match.archived)
    )
      throw new Error(
        `Riga ${row.row}: risolvi prima la corrispondenza con l’archivio.`,
      );
    if (
      (decision.action === "skip" || row.candidates.length > 0) &&
      (reason.length < 3 || reason.length > 500)
    )
      throw new Error(
        `Riga ${row.row}: inserisci una motivazione (3–500 caratteri).`,
      );
    return { row, decision: { ...decision, reason } };
  });
}
