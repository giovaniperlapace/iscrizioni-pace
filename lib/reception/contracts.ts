export type ReceptionLookup = { kind: "qr" | "code"; value: string };
export type ReceptionCommand = {
  lookup: ReceptionLookup;
  action: "inspect" | "enter" | "correct" | "cancel";
  requestId?: string;
  subjectIds?: string[];
  students?: number;
  companions?: number;
  expectedRevision?: number;
  reason?: "selection_error" | "count_error" | "entry_cancelled";
};
export type ReceptionPerson = {
  id: string;
  kind: "adult" | "child";
  firstName: string;
  lastName: string;
  checkedInAt: string | null;
};
type ValidReception = {
  status: "valid";
  revision: number;
  outcome: "verified" | "saved" | "unchanged" | "replayed";
  registrationStatus: "submitted" | "confirmed";
};
export type ReceptionResult =
  | { status: "invalid" | "conflict" | "forbidden" | "invalid_request" | "unavailable" }
  | (ValidReception & { kind: "family"; code: string; persons: ReceptionPerson[] })
  | (ValidReception & {
      kind: "school"; schoolName: string; classDescription: string;
      expectedStudents: number; expectedCompanions: number;
      students: number; companions: number; checkedInAt: string | null;
    });

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const integer = (value: unknown, max: number) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= max;

// This boundary is deliberately strict: never accept an actor, event or raw
// database identifier for the lookup from a client.
export function parseReceptionCommand(input: unknown): ReceptionCommand | null {
  if (!record(input) || !record(input.lookup) ||
    Object.keys(input).some(key => !["lookup","action","requestId","subjectIds","students","companions","expectedRevision","reason"].includes(key)) ||
    Object.keys(input.lookup).some(key => !["kind","value"].includes(key)) ||
    (typeof input.action !== "string" || !["inspect","enter","correct","cancel"].includes(input.action)) ||
    (typeof input.lookup.kind !== "string" || !["qr","code"].includes(input.lookup.kind)) || typeof input.lookup.value !== "string") return null;
  const kind = input.lookup.kind as ReceptionLookup["kind"];
  // QR is a bare opaque token, never a URL or arbitrary scanner contents.
  const value = kind === "code" ? input.lookup.value.trim().toUpperCase() : input.lookup.value;
  if (!(kind === "qr" ? /^[A-Za-z0-9_-]{43}$/.test(value) : /^[A-Z0-9]{4}$/.test(value))) return null;
  if (input.action === "inspect") {
    if (Object.keys(input).some(key => !["lookup","action"].includes(key))) return null;
    return { lookup: { kind, value }, action: "inspect" };
  }
  if (typeof input.requestId !== "string" || !uuid.test(input.requestId)) return null;
  if (input.subjectIds !== undefined && (!Array.isArray(input.subjectIds) || input.subjectIds.length > 11 ||
    input.subjectIds.some(id => typeof id !== "string" || !uuid.test(id)) || new Set(input.subjectIds).size !== input.subjectIds.length)) return null;
  if ((input.students !== undefined && !integer(input.students,1000)) ||
    (input.companions !== undefined && !integer(input.companions,100)) ||
    (input.expectedRevision !== undefined && !integer(input.expectedRevision,2147483647))) return null;
  if (input.reason !== undefined && (typeof input.reason !== "string" || !["selection_error","count_error","entry_cancelled"].includes(input.reason))) return null;
  if (["correct","cancel"].includes(String(input.action)) &&
    (input.expectedRevision === undefined || input.reason === undefined)) return null;
  return { ...input, lookup: { kind, value } } as ReceptionCommand;
}
