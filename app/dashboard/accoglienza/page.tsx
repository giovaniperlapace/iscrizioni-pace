import { ReceptionConsole } from "./reception-console";
import { receptionCheckIn } from "./actions";

import { redirect } from "next/navigation";

import {
  DashboardAreaDescription,
  DashboardRoleTabs,
} from "@/app/dashboard/role-tabs";
import { getCurrentAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AccoglienzaDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(supabase, "accoglienza");

  if (!auth || auth.dashboardRole !== "accoglienza") {
    redirect("/login");
  }

  const { data: event, error } = await supabase.from("events").select("id,title").eq("is_current", true).maybeSingle();
  if (error) throw new Error("Impossibile caricare l’evento dell’accoglienza.");
  const authorized = event && auth.eventRoles.some(role =>
    (role.role === "admin" && role.eventId === null) ||
    (["manager", "accoglienza"].includes(role.role) && role.eventId === event.id));

  return (
    <main className="app-page text-[var(--peace-ink)]">
      <section className="mx-auto grid w-full max-w-5xl gap-6 px-5 py-8 sm:px-8">
        <header className="grid gap-3">
          <h1 className="sr-only">Dashboard accoglienza</h1>
          <DashboardRoleTabs
            activeRole="accoglienza"
            eventRoles={auth.eventRoles}
          />
          <DashboardAreaDescription>
            Verifica i codici e registra le persone realmente presenti
            con i soli dati necessari all’ingresso.
          </DashboardAreaDescription>
        </header>
        {authorized ? <>
          <p className="text-sm font-semibold">{event.title}</p>
          <ReceptionConsole commandAction={receptionCheckIn.bind(null, event.id)} />
        </> : <p role="alert" className="surface-card p-5">Nessun incarico di accoglienza autorizzato nell’evento corrente. Rivolgiti a un amministratore.</p>}
      </section>
    </main>
  );
}
