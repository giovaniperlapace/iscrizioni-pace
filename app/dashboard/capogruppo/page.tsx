import { redirect } from "next/navigation";

import { PersonalRegistrationCard } from "@/app/dashboard/personal-registration-card";
import { getCurrentAuthContext } from "@/lib/auth/session";
import { getPersonalRegistrationSummary } from "@/lib/registrations/personal-registration";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function CapogruppoDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(supabase, "capogruppo");

  if (!auth || auth.dashboardRole !== "capogruppo") {
    redirect("/login");
  }

  const eventIds = auth.eventRoles
    .filter((role) => role.role === "capogruppo")
    .map((role) => role.eventId)
    .filter((eventId): eventId is string => Boolean(eventId));

  const [{ count: groupsCount }, personalRegistration] = await Promise.all([
    supabase
      .from("group_memberships")
      .select("id", { count: "exact", head: true }),
    getPersonalRegistrationSummary(supabase, auth.user.id, eventIds),
  ]);

  return (
    <main className="min-h-screen bg-[#f7f8f3] text-[#1c241f]">
      <section className="mx-auto grid w-full max-w-5xl gap-6 px-5 py-8 sm:px-8">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#5d765f]">
            Area protetta
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Dashboard capogruppo</h1>
          <p className="mt-3 max-w-3xl text-[#4b5a50]">
            Accesso verificato per {auth.user.email}. Questa vista minima
            conferma i nodi o gruppi assegnati e prepara la gestione delle
            assegnazioni della Milestone 9.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <Metric label="Ruolo dashboard" value={auth.dashboardRole} />
          <Metric label="Eventi collegati" value={String(eventIds.length)} />
          <Metric label="Nodi assegnati" value={String(groupsCount ?? 0)} />
        </section>

        <PersonalRegistrationCard summary={personalRegistration} />

        <section className="rounded-lg border border-[#d8dece] bg-white p-5">
          <h2 className="text-lg font-semibold">Gestione gruppi</h2>
          <p className="mt-2 text-sm leading-6 text-[#5e6d63]">
            La gestione operativa dei partecipanti assegnati arriverà nella
            dashboard capogruppo minima. Il tuo ruolo può essere collegato a un
            paese, una città, un&apos;area o un singolo gruppo dell&apos;albero.
          </p>
        </section>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#d8dece] bg-white p-5">
      <p className="text-sm text-[#5e6d63]">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
