import { ReceptionWorkstation } from "./reception-workstation";
import { loadPanelReceptionDuties, type ReceptionDuty } from "@/lib/reception/duties.server";
import { receptionCheckIn } from "./actions";

import { redirect } from "next/navigation";

import { DashboardRoleTabs } from "@/app/dashboard/role-tabs";
import { getCurrentAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AccoglienzaDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(supabase, "accoglienza");

  if (!auth || auth.dashboardRole !== "accoglienza") {
    redirect("/login");
  }

  const pilot = auth.eventRoles.some(role => role.role === "admin" && role.eventId === null);
  if (!pilot) return <main className="app-page"><section className="mx-auto grid max-w-5xl gap-5 px-5 py-8"><DashboardRoleTabs activeRole="accoglienza" eventRoles={auth.eventRoles} /><h1>Dashboard accoglienza</h1><p>Le funzioni di scansione sono in collaudo riservato all’Admin.</p></section></main>;

  const { data: event, error } = await supabase.from("events").select("id").eq("is_current", true).maybeSingle();
  if (error) throw new Error("Impossibile caricare l’evento dell’accoglienza.");
  const authorized = event && auth.eventRoles.some(role =>
    (role.role === "admin" && role.eventId === null) ||
    (["manager", "accoglienza"].includes(role.role) && role.eventId === event.id));

  const readiness = await supabase.rpc("admin_reception_pilot_ready");
  const ready = !readiness.error && readiness.data === true;
  const duties: ReceptionDuty[] = event && ready ? await loadPanelReceptionDuties(supabase) : [];
  if (authorized && ready) duties.unshift({ key: "event_entry", duty: "event_entry", title: "Accoglienza evento", room: null });

  return (
    <main className="app-page text-[var(--peace-ink)]">
      <section className="mx-auto grid w-full max-w-5xl gap-6 px-5 py-8 sm:px-8">
        <header className="grid gap-3">
          <h1 className="sr-only">Dashboard accoglienza</h1>
          <DashboardRoleTabs
            activeRole="accoglienza"
            eventRoles={auth.eventRoles} hasReceptionAssignments={auth.hasReceptionAssignments}
          />
        </header>
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">Funzioni riservate agli account Admin. Da computer puoi usare lo scanner USB e stampare le etichette QR. In modalità telefono usi la fotocamera e gestisci solo le presenze, senza stampa. All’ingresso evento la lettura apre la scheda; le presenze richiedono una conferma esplicita.</p>
        {ready ? <ReceptionWorkstation duties={duties} commandAction={receptionCheckIn.bind(null, event?.id ?? "")} /> : <p role="alert" className="rounded-lg border p-4">Scanner operativo non ancora attivato in questo ambiente. Prima del collaudo applicativo occorre verificare e applicare le migration autorizzate. Il collaudo stampante con campioni sintetici è indipendente.</p>}
      </section>
    </main>
  );
}
