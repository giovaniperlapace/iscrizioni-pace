import { redirect } from "next/navigation";

import { PersonalRegistrationCard } from "@/app/dashboard/personal-registration-card";
import { getCurrentAuthContext } from "@/lib/auth/session";
import { getPersonalRegistrationSummary } from "@/lib/registrations/personal-registration";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type EventRow = {
  id: string;
  slug: string;
  title: string;
  city: string;
  starts_on: string | null;
};

export default async function ManagerDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(supabase, "manager");

  if (!auth) {
    redirect("/login");
  }

  const eventIds = auth.eventRoles
    .filter((role) => role.role === "manager" || role.role === "manager_viewer")
    .map((role) => role.eventId)
    .filter((eventId): eventId is string => Boolean(eventId));

  const [
    { data: events },
    { count: registrationsCount },
    personalRegistration,
  ] = await Promise.all([
    eventIds.length > 0
      ? supabase
          .from("events")
          .select("id,slug,title,city,starts_on")
          .in("id", eventIds)
          .order("starts_on", { ascending: false })
      : Promise.resolve({ data: [] }),
    eventIds.length > 0
      ? supabase
          .from("registrations")
          .select("id", { count: "exact", head: true })
          .in("event_id", eventIds)
      : Promise.resolve({ count: 0 }),
    getPersonalRegistrationSummary(supabase, auth.user.id, eventIds),
  ]);

  return (
    <main className="min-h-screen bg-[#f7f8f3] text-[#1c241f]">
      <section className="mx-auto grid w-full max-w-5xl gap-6 px-5 py-8 sm:px-8">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#5d765f]">
            Area protetta
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Dashboard manager</h1>
          <p className="mt-3 max-w-3xl text-[#4b5a50]">
            Accesso verificato per {auth.user.email}. Questa vista iniziale
            conferma gli eventi assegnati e il conteggio iscrizioni visibile.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <Metric label="Ruolo dashboard" value={auth.dashboardRole} />
          <Metric label="Eventi assegnati" value={String(eventIds.length)} />
          <Metric label="Iscrizioni visibili" value={String(registrationsCount ?? 0)} />
        </section>

        <PersonalRegistrationCard summary={personalRegistration} />

        <section className="rounded-lg border border-[#d8dece] bg-white p-5">
          <h2 className="text-lg font-semibold">Eventi assegnati</h2>
          <div className="mt-4 grid gap-3">
            {((events ?? []) as EventRow[]).map((event) => (
              <div
                key={event.id}
                className="grid gap-1 border-b border-[#e6eadf] pb-3 last:border-b-0 last:pb-0"
              >
                <p className="font-medium">{event.title}</p>
                <p className="text-sm text-[#5e6d63]">
                  {event.city} - {event.slug}
                </p>
              </div>
            ))}
            {eventIds.length === 0 ? (
              <p className="text-sm text-[#5e6d63]">
                Nessun evento manager assegnato a questo utente.
              </p>
            ) : null}
          </div>
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
