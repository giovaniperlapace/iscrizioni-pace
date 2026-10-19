import { redirect } from "next/navigation";
import { CeremonyNavigation } from "../navigation";
import { createAdminPilotClient as createSupabaseServerClient } from "@/lib/reception/admin-pilot.server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { ceremonyContext } from "@/lib/ceremonies/service";
import { loadDistribution } from "@/lib/ceremonies/distribution.server";
import { CeremonyDistribution } from "@/app/dashboard/ceremony-distribution";
import {
  saveManagerNominee,
  refreshManagerDistribution,
} from "@/app/dashboard/ceremony-distribution-actions";
export default async function Page({ searchParams }: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const kind = (await searchParams).kind === "closing" ? "closing" : "opening";
  const db = await createSupabaseServerClient(),
    context = await ceremonyContext(db);
  if (!context) redirect("/dashboard");
  const view = await loadDistribution(
    db,
    createSupabaseServiceClient,
    "manager",
  );
  return (
    <main className="app-page">
      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-8 sm:px-8">
        <CeremonyNavigation eventTitle={context.event.title} dashboard={context.dashboard} kind={kind} active="people" />
        <section className="surface-card grid gap-2 p-5">
          <h2 className="text-lg font-semibold">Scegli chi utilizzerà i posti del gruppo</h2>
          <p className="text-sm leading-6 text-[var(--peace-muted)]">Seleziona una dotazione, cioè i posti già riservati a un gruppo, e assegnali ai suoi membri. Per ogni minore indica separatamente se serve un posto. Le assegnazioni dirette a una persona si creano in Preparazione e quote e sono consultabili anche qui.</p>
        </section>
        <CeremonyDistribution
          key={kind}
          kind={kind}
          mode="manager"
          initialView={view}
          locale="it"
          canManage={context.canManage}
          save={saveManagerNominee}
          refresh={refreshManagerDistribution}
        />
      </div>
    </main>
  );
}
