import { redirect } from "next/navigation";
import Link from "@/components/pending-link";
import { CeremonyNavigation } from "../navigation";
import { createCeremonyManagerClient as createSupabaseServerClient } from "@/lib/ceremonies/access.server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { ceremonyContext, loadCeremony } from "@/lib/ceremonies/service";
import { loadSeatMap } from "@/lib/ceremonies/seat-map.server";
import { CeremonyMapWorkspace } from "@/app/dashboard/ceremony-map-workspace";
import {
  refreshManagerMap,
  saveManagerMap,
} from "@/app/dashboard/ceremony-map-actions";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; allocation?: string }>;
}) {
  const db = await createSupabaseServerClient(),
    context = await ceremonyContext(db);
  if (!context) redirect("/dashboard");
  const kind = (await searchParams).kind === "closing" ? "closing" : "opening";
  const snapshot = await loadCeremony(
    createSupabaseServiceClient(),
    context,
    kind,
  );
  const view = snapshot.plan
    ? await loadSeatMap(
        db,
        createSupabaseServiceClient,
        "manager",
        snapshot.plan.id,
      )
    : null;
  return (
    <main className="app-page">
      <div className="mx-auto grid max-w-6xl min-w-0 gap-5 px-4 py-8 sm:px-8">
        <CeremonyNavigation eventTitle={context.event.title} dashboard={context.dashboard} kind={kind} active="map" />
        <section className="surface-card grid gap-2 p-5">
          <h2 className="text-lg font-semibold">Completa le assegnazioni con fila e numero, se previsti</h2>
          <p className="text-sm leading-6 text-[var(--peace-muted)]">Prima prepara e pubblica la piantina della sede. Poi riserva le sedute alle dotazioni e abbinale alle persone che hanno già un posto assegnato. Se la cerimonia non prevede posti numerati, puoi fermarti alle assegnazioni per settore.</p>
        </section>
        {view ? (
          <CeremonyMapWorkspace
            key={view.planId}
            embedded
            initialView={view}
            initialAllocation={(await searchParams).allocation}
            locale="it"
            admin={context.admin}
            manager
            canManage={context.canManage}
            save={saveManagerMap}
            refresh={refreshManagerMap}
          />
        ) : (
          <section className="surface-card grid justify-items-start gap-3 p-5">
            <h2 className="text-lg font-semibold">La piantina non è ancora pronta da configurare</h2>
            <p className="text-sm leading-6 text-[var(--peace-muted)]">Crea prima una bozza della cerimonia e aggiungi i settori. Quando conoscerai la disposizione reale, potrai disegnare file e sedute. Non occorre inventare una piantina adesso.</p>
            <Link prefetch={false} href={`/dashboard/manager/cerimonie?kind=${kind}#sede`} className="btn-secondary inline-flex min-h-11 items-center justify-center px-4">Vai alla preparazione</Link>
          </section>
        )}
      </div>
    </main>
  );
}
