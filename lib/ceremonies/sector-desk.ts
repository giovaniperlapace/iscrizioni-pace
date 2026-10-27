import { isMapId } from "./seat-map.ts";
import type { SeatsDesk } from "./seats-desk.ts";
export type SectorPerson = {
  registrationId: string;
  childId: string | null;
  name: string;
  code: string;
  parent: string | null;
  attendance: "yes" | "no" | "unknown";
  nomineeId: string | null;
  needsSeat: boolean | null;
  sector: string | null;
  children?: {
    id: string;
    name: string;
    nomineeId: string | null;
    sector: string | null;
  }[];
};
export type SectorDirectoryQuery = {
  planId: string;
  groupId: string | null;
  withoutGroup: boolean;
  search: string;
  page: number;
};
export type SectorDirectory = {
  revision: number;
  page: number;
  pageCount: number;
  total: number;
  people: SectorPerson[];
  summary: {
    total: number;
    assigned: number;
    withoutSeat: number;
    unassigned: number;
  };
  reserves: {
    sectorId: string;
    sector: string;
    quantity: number;
    used: number;
  }[];
};
export type SectorReadResult =
  | { status: "loaded"; desk: SeatsDesk; directory: SectorDirectory | null }
  | { status: "invalid" | "forbidden" | "unavailable" };
export type SectorReadOptions = { mapOnly?: boolean };
export type LeaderBatchCommand = {
  allocationId: string;
  revision: number;
  requestId: string;
  subjects: { registrationId: string; childId: string | null }[];
};
export function parseSectorDirectoryQuery(
  input: unknown,
): SectorDirectoryQuery | null {
  if (!input || typeof input !== "object") return null;
  const q = input as SectorDirectoryQuery;
  return isMapId(q.planId) &&
    (q.groupId === null || isMapId(q.groupId)) &&
    typeof q.withoutGroup === "boolean" &&
    !(q.groupId && q.withoutGroup) &&
    typeof q.search === "string" &&
    q.search.length <= 200 &&
    Number.isInteger(q.page) &&
    q.page >= 1 &&
    q.page <= 1000000
    ? q
    : null;
}
export function parseLeaderBatch(input: unknown): LeaderBatchCommand | null {
  if (!input || typeof input !== "object") return null;
  const c = input as LeaderBatchCommand;
  return isMapId(c.allocationId) &&
    isMapId(c.requestId) &&
    Number.isInteger(c.revision) &&
    c.revision >= 0 &&
    c.revision < 2147483647 &&
    Array.isArray(c.subjects) &&
    c.subjects.length > 0 &&
    c.subjects.length <= 10000 &&
    c.subjects.every(
      (s) =>
        s &&
        isMapId(s.registrationId) &&
        (s.childId === null || isMapId(s.childId)),
    ) &&
    new Set(c.subjects.map((s) => s.childId ?? s.registrationId)).size ===
      c.subjects.length
    ? c
    : null;
}
export const subjectKey = (s: {
  registrationId: string;
  childId: string | null;
}) => s.childId ?? s.registrationId;
export function sectorBudget(
  directory: SectorDirectory | null,
  sectorId: string,
) {
  return (directory?.reserves ?? [])
    .filter((r) => r.sectorId === sectorId)
    .reduce((sum, r) => sum + r.quantity - r.used, 0);
}
export const SECTOR_MESSAGES: Record<string, string> = {
  saved: "Assegnazione salvata.",
  conflict:
    "La disponibilità è cambiata. Controlla i dati aggiornati e conferma nuovamente.",
  capacity: "Posti insufficienti. Nessuna assegnazione è stata salvata.",
  family_changed:
    "I figli al seguito sono cambiati. Controlla la famiglia aggiornata e conferma nuovamente.",
  duplicate:
    "Una persona ha già un’assegnazione. Nessuna modifica è stata salvata.",
  ineligible:
    "Iscrizione o appartenenza al gruppo cambiate. Controlla i destinatari.",
  forbidden: "Non sei più autorizzato a gestire questi posti.",
  invalid: "Controlla settore e destinatari.",
  unavailable:
    "Esito non verificabile. Riprova la stessa richiesta per evitare duplicati.",
  unconfigured: "La configurazione del settore deve essere completata.",
};

// All active allocations come from the same authorized desk revision. A person's
// membership is never used to turn a personal allocation into a group reserve.
export function sectorAssignments(desk: SeatsDesk, sectorId: string) {
  const allocations = desk.allocations.filter((a) => a.sectorId === sectorId);
  const directIds = new Set(
    allocations.filter((a) => !a.groupId).map((a) => a.id),
  );
  const nominal = desk.nominees.filter((n) => directIds.has(n.allocationId));
  const groups = allocations
    .filter((a) => a.groupId)
    .map((a) => ({
      ...a,
      people: desk.nominees.filter((n) => n.allocationId === a.id),
    }));
  return {
    nominal,
    nominalCount: nominal.filter((n) => n.needsSeat).length,
    groups,
  };
}
