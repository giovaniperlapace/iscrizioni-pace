import { headers } from "next/headers";
import { userAgent } from "next/server";
import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardRoleTabs } from "@/app/dashboard/role-tabs";
import { ForumReceptionWorkstation } from "./workstation";
import type { DutyOption } from "@/lib/reception/event-duties";
import { compareForums } from "@/lib/panels/forum-order";
export default async function ForumReceptionPage() {
  const phoneOnly=userAgent({headers:await headers()}).device.type === "mobile";
  const db=await createSupabaseServerClient();
  const auth=await getCurrentAuthContext(db,"accoglienza_forum_eventi");
  if(!auth || auth.dashboardRole!=="accoglienza_forum_eventi") redirect("/login");
  const {data,error}=await db.rpc("reception_duty_catalog");
  if(error || !data || !Array.isArray(data.choices) || !Array.isArray(data.assigned)) throw new Error("Impossibile caricare gli incarichi. Riprova.");
  const serverNow=Date.parse(data.serverNow);
  if(!Number.isFinite(serverNow)) throw new Error("Impossibile caricare gli orari degli incarichi. Riprova.");
  const choices=(data.choices as DutyOption[]).filter(item => data.assigned.includes(item.key)).sort(compareForums);
  return <main className="app-page"><section className="mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:px-8">
    <DashboardRoleTabs activeRole="accoglienza_forum_eventi" eventRoles={auth.eventRoles} hasReceptionAssignments={auth.hasReceptionAssignments}/>
    <h1 className="text-2xl font-bold">Accoglienza forum ed eventi</h1>
    <ForumReceptionWorkstation phoneOnly={phoneOnly} eventId={data.eventId} choices={choices} canManage={data.canManage} serverNow={serverNow}/>
  </section></main>;
}
