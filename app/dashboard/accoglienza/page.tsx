import { redirect } from "next/navigation";

import { DashboardPlaceholder } from "@/app/dashboard/placeholder";
import { getCurrentAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AccoglienzaDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(supabase, "accoglienza");

  if (!auth || auth.dashboardRole !== "accoglienza") {
    redirect("/login");
  }

  return (
    <DashboardPlaceholder
      title="Dashboard accoglienza"
      description={`Accesso verificato per ${auth.user.email}. Scansione QR e verifica operativa con dati minimi necessari arriveranno nella milestone accoglienza.`}
    />
  );
}
