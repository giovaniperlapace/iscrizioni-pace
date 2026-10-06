"use server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createOpaqueQrToken, hashQrToken } from "@/lib/qrcode/token";
import { encryptQrToken, decryptQrToken } from "@/lib/qrcode/secure-token";
import { loadLeaderScope } from "@/lib/groups/leader-data.server";
import { renderQrDataUrl } from "@/lib/qrcode/render";

export async function groupReceptionQr(groupId: string, action: "get" | "revoke" | "renew"): Promise<{status:"active";image:string}|{status:"revoked"|"unavailable"}> {
  try {
    if (!/^[0-9a-f-]{36}$/i.test(groupId) || !["get","revoke","renew"].includes(action)) return { status:"unavailable" };
    const session=await createSupabaseServerClient();
    const {data:{user},error:authError}=await session.auth.getUser();
    if(authError || !user) return {status:"unavailable"};
    const {data:event,error}=await session.from("events").select("id").eq("is_current",true).maybeSingle();
    if(error || !event) return {status:"unavailable"};
    const {data:roles,error:roleError}=await session.from("event_user_roles").select("role,event_id").eq("user_id",user.id);
    if(roleError)return {status:"unavailable"};
    const manages=roles?.some(r=>(r.role==="admin" && r.event_id===null) || (r.role==="manager" && r.event_id===event.id));
    if(!manages && !(await loadLeaderScope(session,user.id,event.id)).scopedGroupIds.has(groupId))return {status:"unavailable"};
    const generated=createOpaqueQrToken();
    const {data,error:rpcError}=await createSupabaseServiceClient().rpc("group_reception_credential",{
      p_event:event.id,p_actor:user.id,p_group:groupId,p_action:action,p_hash:generated.tokenHash,p_encrypted:encryptQrToken(generated.token),
    });
    if(rpcError || typeof data?.active!=="boolean") return {status:"unavailable"};
    if(!data.active) return {status:"revoked"};
    const token=decryptQrToken(data.encrypted);
    if(!token || !/^[A-Za-z0-9_-]{43}$/.test(token) || (data.hash && hashQrToken(token)!==data.hash)) return {status:"unavailable"};
    return {status:"active",image:await renderQrDataUrl(`G:${token}`)};
  } catch {return {status:"unavailable"};}
}
