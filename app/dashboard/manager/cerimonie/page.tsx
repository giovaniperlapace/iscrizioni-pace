import { redirect } from "next/navigation";
import { CeremonyNavigation } from "./navigation";
import { createCeremonyManagerClient as createSupabaseServerClient } from "@/lib/ceremonies/access.server";
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
        <CeremonyNavigation eventTitle={context.event.title} dashboard={context.dashboard} kind={kind} active="preparation" />
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
