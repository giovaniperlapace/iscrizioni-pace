import { redirect } from "next/navigation";
import Link from "@/components/pending-link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/auth/session";
import { ForumReceptionDemo } from "./demo";

export default async function ForumReceptionDemoPage() {
  const db=await createSupabaseServerClient();
  const auth=await getCurrentAuthContext(db,"accoglienza_forum_eventi");
  if(!auth)redirect("/login");
  const {data,error}=await db.rpc("reception_duty_catalog");
  if(error || !data || !data.canManage && !data.assigned?.length)redirect("/dashboard");
  return <main className="app-page"><div className="mx-auto grid max-w-5xl gap-5 px-4 py-6 sm:px-8">
    <Link className="justify-self-start underline" href={auth.dashboardPath}>Torna alla dashboard</Link>
    <h1 className="text-2xl font-bold">Prova accoglienza forum ed eventi</h1>
    <ForumReceptionDemo/>
  </div></main>;
}
