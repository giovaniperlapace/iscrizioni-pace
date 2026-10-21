import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { executeReceptionCommand } from "@/lib/reception/check-in.server";
import { parseReceptionCommand } from "@/lib/reception/contracts";
import { parseDeskRequest } from "@/lib/reception/forum-desk";
import { validDutyKey } from "@/lib/reception/event-duties";
import { hashQrToken } from "@/lib/qrcode/token";
const reply = (body: unknown, status=200) => Response.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  // Next may use its internal hostname in request.url. The incoming Host is
  // browser-controlled and preserves the public authority across the proxy.
  if (!origin || origin !== `${url.protocol}//${request.headers.get("host") ?? url.host}` || request.headers.get("sec-fetch-site") === "cross-site") return reply({status:"forbidden"},403);
  try {
    const body = await request.json();
    const db = await createSupabaseServerClient();
    const {data:{user},error:authError} = await db.auth.getUser();
    if(authError || !user) return reply({status:"forbidden"},403);
    const {data:event,error:eventError}=await db.from("events").select("id").eq("is_current",true).maybeSingle();
    if(eventError || !event) return reply({status:"unavailable"});
    if(body.eventId !== event.id) return reply({status:"forbidden"},403);
    if(body.operation === "scan") {
      const command=parseReceptionCommand(body.command);
      if(!command || !["panel_entry","ceremony_entry"].includes(command.duty)) return reply({status:"invalid_request"},400);
      return reply(await executeReceptionCommand(db,createSupabaseServiceClient,command,event.id));
    }
    if(body.operation === "statistics" && validDutyKey(body.target)) {
      const {data,error}=await createSupabaseServiceClient().rpc("reception_target_statistics",{p_event:event.id,p_actor:user.id,p_target:body.target});
      return reply(error ? {status:error.code === "42501" ? "forbidden" : "unavailable"} : {status:"ready",...data});
    }
    if(body.operation !== "desk") return reply({status:"invalid_request"},400);
    const command=parseDeskRequest(body.command);
    if(!command) return reply({status:"invalid_request"},400);
    const {data,error}=await createSupabaseServiceClient().rpc("reception_desk",{
      p_event:event.id,p_actor:user.id,p_target:command.target,p_kind:command.lookup.kind,
      p_value:command.lookup.kind === "qr" ? hashQrToken(command.lookup.value) : command.lookup.value,
      p_operation:command.operation,p_option:command.option ?? null,p_children:command.children ?? [],p_request:command.request ?? null,
    });
    const codes:Record<string,string>={"42501":"forbidden","22023":"invalid_request",PFA01:"attendance_required","23P01":"booking_conflict",P0001:"capacity_exceeded"};
    return reply(error ? {status:codes[error.code] ?? "unavailable"} : data);
  } catch { return reply({status:"unavailable"}); }
}
