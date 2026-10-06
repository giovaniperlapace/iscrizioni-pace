import { redirect } from "next/navigation";
import Link from "@/components/pending-link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { ceremonyContext, loadCeremony } from "@/lib/ceremonies/service";
import { CeremonyWorkspace } from "./workspace";
import { saveCeremony } from "./actions";
export default async function CeremoniesPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const context = await ceremonyContext(await createSupabaseServerClient());
  if (!context) redirect("/dashboard");
  const kind = (await searchParams).kind === "closing" ? "closing" : "opening";
  const snapshot = await loadCeremony(
    createSupabaseServiceClient(),
    context,
    kind,
  );
  return (
    <main className="app-page text-[var(--peace-ink)]">
      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-8 sm:px-8">
        <Link
          className="underline"
          href={`/dashboard/${context.dashboard}?section=panel`}
        >
          Torna ai panel
        </Link>
        <header>
          <p className="text-sm text-[var(--peace-muted)]">
            {context.event.title}
          </p>
          <h1 className="text-2xl font-semibold">
            Eventi speciali · gestione posti
          </h1>
          <p className="mt-2">
            Inaugurazione e cerimonia finale hanno sedi e configurazioni
            indipendenti.
          </p>
        </header>
        <Link
          href="/dashboard/manager/cerimonie/distribuzione"
          className="btn-secondary min-h-11 justify-self-start px-4"
        >
          Distribuzione nominale e scelte dei minori
        </Link>
        <Link href={`/dashboard/manager/cerimonie/mappa?kind=${kind}`} className="btn-secondary min-h-11 justify-self-start px-4">Piantina e posti numerati</Link>
        <CeremonyWorkspace
          key={kind}
          kind={kind}
          snapshot={snapshot}
          admin={context.admin}
          canManage={context.canManage}
          save={saveCeremony}
        />
      </div>
    </main>
  );
}
