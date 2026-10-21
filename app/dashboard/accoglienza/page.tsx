import { ReceptionWorkstation } from "./reception-workstation";
import { loadPanelReceptionDuties, type ReceptionDuty } from "@/lib/reception/duties.server";
import { receptionCheckIn } from "./actions";
import { canOperateReception } from "@/lib/reception/access";

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

  const { data: event, error } = await supabase.from("events").select("id").eq("is_current", true).maybeSingle();
  if (error) throw new Error("Impossibile caricare l’evento dell’accoglienza.");
  const authorized = event && canOperateReception(auth.eventRoles.map(role => ({ role: role.role, event_id: role.eventId })), event.id);
  if (!authorized) return <main className="app-page"><section className="mx-auto grid max-w-5xl gap-5 px-5 py-8"><DashboardRoleTabs activeRole="accoglienza" eventRoles={auth.eventRoles} hasReceptionAssignments={auth.hasReceptionAssignments} /><h1>Dashboard accoglienza</h1><p>Nessun ruolo Accoglienza assegnato per l’evento corrente. Rivolgiti a un amministratore.</p></section></main>;

  const readiness = await supabase.rpc("reception_ready");
  const ready = !readiness.error && readiness.data === true;
  const duties: ReceptionDuty[] = event && ready ? (await loadPanelReceptionDuties(supabase)).filter(duty => duty.duty === "room_assistance") : [];
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
        {ready ? <ReceptionWorkstation duties={duties} commandAction={receptionCheckIn.bind(null, event.id)} /> : <p role="alert" className="rounded-lg border p-4">Accoglienza momentaneamente non disponibile. Ricarica la pagina o rivolgiti a un amministratore.</p>}
      </section>
    </main>
  );
}
