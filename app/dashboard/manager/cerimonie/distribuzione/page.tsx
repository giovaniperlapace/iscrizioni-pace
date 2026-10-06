import { redirect } from "next/navigation";
import Link from "@/components/pending-link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { ceremonyContext } from "@/lib/ceremonies/service";
import { loadDistribution } from "@/lib/ceremonies/distribution.server";
import { CeremonyDistribution } from "@/app/dashboard/ceremony-distribution";
import {
  saveManagerNominee,
  refreshManagerDistribution,
} from "@/app/dashboard/ceremony-distribution-actions";
export default async function Page() {
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
        <Link className="underline" href="/dashboard/manager/cerimonie">
          Torna alle cerimonie
        </Link>
        <p>
          Come manager puoi assegnare posti ai singoli membri delle dotazioni di
          tutti i gruppi dell’evento e gestire le scelte per ciascun minore. Per
          assegnare direttamente un posto dalla quota a una persona, usa la
          gestione cerimonie.
        </p>
        <CeremonyDistribution
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
