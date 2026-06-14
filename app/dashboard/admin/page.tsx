import { redirect } from "next/navigation";

import { getCurrentAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type EventRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
};

export default async function AdminDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(supabase, "admin");

  if (!auth) {
    redirect("/login");
  }

  const [{ data: events }, { data: roles }] = await Promise.all([
    supabase
      .from("events")
      .select("id,slug,title,status")
      .order("starts_on", { ascending: false }),
    supabase
      .from("event_user_roles")
      .select("role,event_id")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <main className="min-h-screen bg-[#f7f8f3] text-[#1c241f]">
      <section className="mx-auto grid w-full max-w-5xl gap-6 px-5 py-8 sm:px-8">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#5d765f]">
            Area protetta
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Dashboard admin</h1>
          <p className="mt-3 max-w-3xl text-[#4b5a50]">
            Accesso verificato per {auth.user.email}. Questa vista iniziale
            conferma ruolo globale, eventi disponibili e bootstrap utenti.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <Metric label="Ruolo dashboard" value={auth.dashboardRole} />
          <Metric label="Eventi visibili" value={String(events?.length ?? 0)} />
          <Metric label="Ruoli assegnati" value={String(roles?.length ?? 0)} />
        </section>

        <section className="rounded-lg border border-[#d8dece] bg-white p-5">
          <h2 className="text-lg font-semibold">Eventi</h2>
          <div className="mt-4 grid gap-3">
            {((events ?? []) as EventRow[]).map((event) => (
              <div
                key={event.id}
                className="grid gap-1 border-b border-[#e6eadf] pb-3 last:border-b-0 last:pb-0"
              >
                <p className="font-medium">{event.title}</p>
                <p className="text-sm text-[#5e6d63]">
                  {event.slug} - {event.status}
                </p>
              </div>
            ))}
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
