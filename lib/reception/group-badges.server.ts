import type { SupabaseClient } from "@supabase/supabase-js";
import { parseBadgeCommand, type BadgeResult } from "./group-badges.ts";
import { hashQrToken } from "../qrcode/token.ts";
import { decryptQrToken } from "../qrcode/secure-token.ts";
import { renderQrDataUrl } from "../qrcode/render.ts";

export async function executeBadgeCommand(session: SupabaseClient, service: () => SupabaseClient, input: unknown): Promise<BadgeResult> {
  try {
    const command = parseBadgeCommand(input);
    if (!command) return { status: "invalid" };
    const { data: { user }, error: authError } = await session.auth.getUser();
    if (authError || !user) return { status: "forbidden" };
    const { data: event, error: eventError } = await session.from("events").select("id").eq("is_current",true).maybeSingle();
    if (eventError || !event) return { status: "unavailable" };
    const { data: roles, error: rolesError } = await session.from("event_user_roles").select("role,event_id").eq("user_id",user.id);
    if (rolesError) return { status: "unavailable" };
    if (!roles?.some(r=>(r.role==="admin" && r.event_id===null) || (["manager","accoglienza"].includes(r.role) && r.event_id===event.id))) return { status: "forbidden" };
    const { data, error } = await service().rpc("group_badge_queue", {
      p_event:event.id,p_actor:user.id,p_hash:hashQrToken(command.token.slice(2)),p_action:command.action,
      p_batch:command.batchId??null,p_registrations:command.registrationIds??[],p_snapshot:command.snapshot??null,p_registration:command.registrationId??null,p_expected_attempts:command.expectedAttempts??null,
    });
    if (error) return { status:error.code==="42501"?"forbidden":"unavailable" };
    if (["empty","invalid","conflict","qr_unavailable","already_prepared"].includes(data?.status)) return { status:data.status };
    if (data?.status==="ready") {
      const token = decryptQrToken(data.encrypted);
      if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token) || hashQrToken(token)!==data.hash || typeof data.person?.firstName!=="string" || typeof data.person?.lastName!=="string" || typeof data.person?.code!=="string") return { status:"qr_unavailable" };
      return { status:"ready", image:await renderQrDataUrl(token), name:`${data.person.firstName} ${data.person.lastName}`, code:data.person.code };
    }
    if (data?.status!=="queue" || typeof data.batchId!=="string" || !Array.isArray(data.items) || !data.items.every((i:Record<string,unknown>)=>
      typeof i.registrationId==="string" && Number.isSafeInteger(i.position) && Number.isSafeInteger(i.attempts) && ["pending","prepared","verified"].includes(String(i.state)) &&
      typeof i.available==="boolean" && (i.name===null || typeof i.name==="string") && (i.code===null || typeof i.code==="string"))) return { status:"unavailable" };
    return { status:"queue", batchId:data.batchId, items:data.items.map((i:Record<string,unknown>)=>({registrationId:i.registrationId,position:i.position,state:i.state,attempts:i.attempts,name:i.name,code:i.code,available:i.available})) } as BadgeResult;
  } catch { return { status:"unavailable" }; }
}
