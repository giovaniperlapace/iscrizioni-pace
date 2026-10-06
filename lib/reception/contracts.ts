import type { CeremonySeatInfo } from "../ceremonies/seat-projection.ts";
export type ReceptionLookup = { kind: "qr" | "code"; value: string };
export type ReceptionCommand = {
  duty: "event_entry" | "panel_entry" | "room_assistance";
  panelId?: string;
  groupSnapshot?: string;
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
  ceremonies?: CeremonySeatInfo[];
  id: string;
  kind: "adult" | "child";
  firstName: string;
  lastName: string;
  checkedInAt: string | null;
  eventCheckedIn?: boolean;
};
type ValidReception = {
  status: "valid";
  panel?: { id: string; title: string; room: string; section: string };
  revision: number;
  outcome: "verified" | "saved" | "unchanged" | "replayed";
  registrationStatus: "submitted" | "confirmed";
};
export type ReceptionResult =
  | { status: "invalid" | "conflict" | "forbidden" | "invalid_request" | "unavailable" | "not_booked" | "event_entry_required" | "capacity_exceeded" | "panel_unavailable" }
  | (ValidReception & { kind: "room"; label: string; panel: { id: string; title: string; room: string; section: string } })
  | (ValidReception & { kind: "group"; groupId: string; groupName: string; snapshot: string; persons: (ReceptionPerson & { registrationId: string; code: string })[] })
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
  if (!record(input) || typeof input.duty !== "string" || !["event_entry", "panel_entry", "room_assistance"].includes(input.duty) || !record(input.lookup) ||
    Object.keys(input).some(key => !["duty","panelId","groupSnapshot","lookup","action","requestId","subjectIds","students","companions","expectedRevision","reason"].includes(key)) ||
    Object.keys(input.lookup).some(key => !["kind","value"].includes(key)) ||
    (typeof input.action !== "string" || !["inspect","enter","correct","cancel"].includes(input.action)) ||
    (typeof input.lookup.kind !== "string" || !["qr","code"].includes(input.lookup.kind)) || typeof input.lookup.value !== "string") return null;
  if (input.duty === "event_entry" ? input.panelId !== undefined : typeof input.panelId !== "string" || !uuid.test(input.panelId)) return null;
  if (input.duty === "room_assistance" && input.action !== "inspect") return null;
  const context = input.duty === "event_entry" ? { duty: "event_entry" as const } :
    { duty: input.duty as "panel_entry" | "room_assistance", panelId: input.panelId as string };
  const kind = input.lookup.kind as ReceptionLookup["kind"];
  // QR is a bare opaque token, never a URL or arbitrary scanner contents.
  const value = kind === "code" ? input.lookup.value.trim().toUpperCase() : input.lookup.value;
  const group = kind === "qr" && /^G:[A-Za-z0-9_-]{43}$/.test(value);
  if (group && input.duty !== "event_entry") return null;
  if (input.groupSnapshot !== undefined && (!group || typeof input.groupSnapshot !== "string" || !/^[a-f0-9]{64}$/.test(input.groupSnapshot))) return null;
  if (!(group || (kind === "qr" ? /^[A-Za-z0-9_-]{43}$/.test(value) : /^[A-Z0-9]{4}$/.test(value)))) return null;
  if (input.action === "inspect") {
    if (Object.keys(input).some(key => !["duty","panelId","lookup","action"].includes(key))) return null;
    return { ...context, lookup: { kind, value }, action: "inspect" };
  }
  if (group && (input.groupSnapshot === undefined || input.students !== undefined || input.companions !== undefined)) return null;
  if (typeof input.requestId !== "string" || !uuid.test(input.requestId)) return null;
  if (input.subjectIds !== undefined && (!Array.isArray(input.subjectIds) || input.subjectIds.length > (group ? 10000 : 11) ||
    input.subjectIds.some(id => typeof id !== "string" || !uuid.test(id)) || new Set(input.subjectIds).size !== input.subjectIds.length)) return null;
  if ((input.students !== undefined && !integer(input.students,1000)) ||
    (input.companions !== undefined && !integer(input.companions,100)) ||
    (input.expectedRevision !== undefined && !integer(input.expectedRevision,2147483647))) return null;
  if (input.reason !== undefined && (typeof input.reason !== "string" || !["selection_error","count_error","entry_cancelled"].includes(input.reason))) return null;
  if (["correct","cancel"].includes(String(input.action)) &&
    (input.expectedRevision === undefined || input.reason === undefined)) return null;
  return { ...input, lookup: { kind, value } } as ReceptionCommand;
}
