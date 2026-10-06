import type { CeremonySeatInfo } from "../ceremonies/seat-projection.ts";
export type BadgeItem = { registrationId: string; position: number; state: "pending" | "prepared" | "verified"; attempts: number; name: string | null; code: string | null; available: boolean };
export type BadgeQueue = { status: "queue"; batchId: string; items: BadgeItem[] };
export type BadgeResult = BadgeQueue | { status: "ready"; ceremonies?: CeremonySeatInfo[]; image: string; name: string; code: string } | { status: "empty" | "invalid" | "conflict" | "forbidden" | "unavailable" | "qr_unavailable" | "already_prepared" };
export type BadgeCommand = { token: string; action: "create" | "read" | "prepare" | "verify" | "reprint"; batchId?: string; registrationIds?: string[]; snapshot?: string; registrationId?: string; expectedAttempts?: number };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parseBadgeCommand(input: unknown): BadgeCommand | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const c = input as BadgeCommand;
  if (Object.keys(c).some(k => !["token","action","batchId","registrationIds","snapshot","registrationId","expectedAttempts"].includes(k)) ||
    typeof c.token !== "string" || !/^G:[A-Za-z0-9_-]{43}$/.test(c.token) || !["create","read","prepare","verify","reprint"].includes(c.action)) return null;
  if (c.batchId !== undefined && !uuid.test(c.batchId)) return null;
  if (c.action === "create") {
    if (!c.batchId || !c.snapshot || !/^[a-f0-9]{64}$/.test(c.snapshot) || !Array.isArray(c.registrationIds) || !c.registrationIds.length || c.registrationIds.length>10000 ||
      c.registrationIds.some(id=>typeof id!=="string" || !uuid.test(id)) || new Set(c.registrationIds).size!==c.registrationIds.length || c.registrationId !== undefined) return null;
  } else if (c.registrationIds !== undefined || c.snapshot !== undefined) return null;
  if (["prepare","verify","reprint"].includes(c.action) && (!c.batchId || !c.registrationId || !uuid.test(c.registrationId))) return null;
  if (c.action === "read" && c.registrationId !== undefined) return null;
  if (["verify","reprint"].includes(c.action) ? !Number.isSafeInteger(c.expectedAttempts) || Number(c.expectedAttempts)<0 : c.expectedAttempts!==undefined) return null;
  return c;
}
