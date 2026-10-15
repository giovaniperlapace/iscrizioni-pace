import type { SupabaseClient } from "@supabase/supabase-js";
import { parseLabelCommand, type LabelResult, type LabelItem } from "./qr-labels.ts";
import { decryptQrToken } from "../qrcode/secure-token.ts";
import { hashQrToken } from "../qrcode/token.ts";
import { renderQrLabelHtml, renderQrLabelsHtml } from "../qrcode/print-label.ts";

type RawItem = LabelItem & { firstName: string; lastName: string; encrypted: string | null; hash: string | null; content: string; printedContent: string | null };
export async function executeLabelCommand(session: SupabaseClient, service: () => SupabaseClient, input: unknown): Promise<LabelResult> {
  try {
    const command = parseLabelCommand(input);
    if (!command) return { status: "invalid" };
    const { data: { user }, error: authError } = await session.auth.getUser();
    if (authError || !user) return { status: "forbidden" };
    const { data: event, error: eventError } = await session.from("events").select("id").eq("is_current", true).maybeSingle();
    if (eventError || !event) return { status: "unavailable" };
    const { data: roles, error: roleError } = await session.from("event_user_roles").select("role,event_id").eq("user_id", user.id);
    if (roleError) return { status: "unavailable" };
    if (!roles?.some(r => (r.role === "admin" && r.event_id === null))) return { status: "forbidden" };
    const db = service();
    async function rpc(action: string) {
      const { data, error } = await db.rpc("qr_label_queue", {
        p_event: event!.id, p_actor: user!.id, p_action: action, p_group: command!.groupId ?? null, p_registration: command!.registrationId ?? null,
        p_ids: command!.ids ?? [], p_snapshot: command!.snapshot ?? null, p_request: command!.requestId ?? null,
        p_profile: command!.profile ?? null, p_outcome: command!.outcome ?? null,
      });
      if (error) return { status: error.code === "42501" ? "forbidden" : ["PGRST202","42883"].includes(error.code) ? "migration_required" : "unavailable" };
      return data;
    }
    const printing = command.action === "print" || command.action === "reprint" || command.action === "request";
    const result = await rpc(printing ? "read" : command.action);
    if (["conflict","replayed","forbidden","unavailable","migration_required"].includes(result?.status)) return { status: result.status };
    if (result?.status !== "queue" || !Array.isArray(result.items) || !/^[a-f0-9]{64}$/.test(result.snapshot)) return { status: "unavailable" };
    const items: RawItem[] = result.items;
    // Decrypt/render only on the server. Never expose encrypted credentials or hashes.
    const printable = new Map<string, { token: string; participant: { first_name: string; last_name: string; public_code: string | null } }>();
    const safe: LabelItem[] = [];
    for (const item of items) {
      if (typeof item.registrationId !== "string" || typeof item.name !== "string" || !["pending","prepared","verified"].includes(item.state) || !Number.isSafeInteger(item.attempts)) return { status: "unavailable" };
      // Keep the canonical snapshot for atomic claims, but omit deleted group
      // members from every response and from the set that can be printed.
      if (command.groupId && item.reason === "deleted") continue;
      let reason = item.reason;
      if (!reason && (!item.code || !item.code.trim())) reason = "identity";
      if (!reason) {
        try {
          const token = decryptQrToken(item.encrypted);
          if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token) || hashQrToken(token) !== item.hash) throw new Error("QR unavailable");
          const label = { token, participant: { first_name: item.firstName, last_name: item.lastName, public_code: item.code } };
          await renderQrLabelHtml(token, label.participant, command.profile ?? "continuous-29x45");
          printable.set(item.registrationId, label);
        } catch { reason = "layout_or_qr"; }
      }
      safe.push({ registrationId: item.registrationId, name: item.name, code: item.code, reason,
        state: item.state, attempts: item.attempts, outcome: item.outcome, changed: item.printedContent !== null && item.printedContent !== item.content });
    }
    if (!printing) return { status: "queue", snapshot: result.snapshot, items: safe };
    if (command.snapshot !== result.snapshot || command.ids!.some(id => !printable.has(id))) return { status: "conflict" };
    // Complete the document before claiming. Claim rechecks identity, QR, scope and
    // versions atomically. A concurrent operator cannot print the same pending item.
    const html = await renderQrLabelsHtml(command.ids!.map(id => printable.get(id)!), command.profile!);
    const claim = await rpc(command.action);
    if (claim?.status !== "claimed") return { status: ["conflict","replayed","forbidden","migration_required"].includes(claim?.status) ? claim.status : "unavailable" };
    return { status: "document", html, requestId: command.requestId! };
  } catch { return { status: "unavailable" }; }
}
