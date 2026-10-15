import { isQrLabelProfile, type QrLabelProfile } from "../qrcode/print-label-profile.ts";
export type LabelScope = { groupId: string; registrationId?: never } | { registrationId: string; groupId?: never };
export type LabelItem = {
  registrationId: string; name: string; code: string | null; reason: string | null;
  state: "pending" | "prepared" | "verified"; attempts: number;
  outcome: "requested" | "browser_returned" | "error" | null; changed: boolean;
};
export type LabelQueue = { status: "queue"; items: LabelItem[]; snapshot: string };
export type LabelResult = LabelQueue | { status: "document"; html: string; requestId: string } |
  { status: "invalid" | "forbidden" | "unavailable" | "migration_required" | "conflict" | "replayed" };
export type LabelCommand = LabelScope & {
  action: "read" | "print" | "reprint" | "request" | "verify" | "outcome";
  ids?: string[]; snapshot?: string; requestId?: string; profile?: QrLabelProfile;
  outcome?: "browser_returned" | "error";
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parseLabelCommand(value: unknown): LabelCommand | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const c = value as LabelCommand;
  if (Object.keys(c).some(k => !["groupId","registrationId","action","ids","snapshot","requestId","profile","outcome"].includes(k))) return null;
  const scopeId = c.groupId ?? c.registrationId;
  if (typeof scopeId !== "string" || (c.groupId === undefined) === (c.registrationId === undefined) || !uuid.test(scopeId)) return null;
  if (!["read","print","reprint","request","verify","outcome"].includes(c.action)) return null;
  if (c.action === "read") return Object.keys(c).length === 2 ? c : null;
  if (c.action === "outcome") return typeof c.requestId === "string" && uuid.test(c.requestId) && ["browser_returned","error"].includes(c.outcome ?? "") &&
    c.ids === undefined && c.snapshot === undefined && c.profile === undefined ? c : null;
  if (!Array.isArray(c.ids) || !c.ids.length || c.ids.length > 10000 || c.ids.some(id => typeof id !== "string" || !uuid.test(id)) || new Set(c.ids).size !== c.ids.length ||
    typeof c.snapshot !== "string" || !/^[a-f0-9]{64}$/.test(c.snapshot) || c.outcome !== undefined) return null;
  if (c.action === "verify") return c.requestId === undefined && c.profile === undefined ? c : null;
  return typeof c.requestId === "string" && uuid.test(c.requestId) && isQrLabelProfile(c.profile) ? c : null;
}
