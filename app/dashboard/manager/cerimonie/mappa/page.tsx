import { redirect } from "next/navigation";
import Link from "@/components/pending-link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
  searchParams: Promise<{ kind?: string }>;
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
        <Link href="/dashboard/manager/cerimonie" className="underline">
          Torna alle cerimonie
        </Link>
        <nav className="flex flex-wrap gap-3" aria-label="Cerimonia">
          <Link className="btn-secondary min-h-11 px-3" href="?kind=opening">
            Inaugurazione
          </Link>
          <Link className="btn-secondary min-h-11 px-3" href="?kind=closing">
            Cerimonia finale
          </Link>
        </nav>
        {view ? (
          <CeremonyMapWorkspace
            key={view.planId}
            initialView={view}
            locale="it"
            admin={context.admin}
            manager
            canManage={context.canManage}
            save={saveManagerMap}
            refresh={refreshManagerMap}
          />
        ) : (
          <p>Prima crea la configurazione della cerimonia e i suoi settori.</p>
        )}
      </div>
    </main>
  );
}
