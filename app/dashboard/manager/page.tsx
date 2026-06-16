import { redirect } from "next/navigation";

import {
  DashboardAreaDescription,
  DashboardRoleTabs,
} from "@/app/dashboard/role-tabs";
import { getCurrentAuthContext } from "@/lib/auth/session";
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

  const [{ data: events }, { count: registrationsCount }] = await Promise.all([
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
  ]);

  return (
    <main className="min-h-screen bg-[#f7f8f3] text-[#1c241f]">
      <section className="mx-auto grid w-full max-w-5xl gap-6 px-5 py-8 sm:px-8">
        <header className="grid gap-3">
          <h1 className="sr-only">Dashboard manager</h1>
          <DashboardRoleTabs activeRole="manager" eventRoles={auth.eventRoles} />
          <DashboardAreaDescription>
            In questa area puoi consultare gli eventi assegnati e seguire il
            conteggio delle iscrizioni visibili.
          </DashboardAreaDescription>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          <Metric label="Eventi assegnati" value={String(eventIds.length)} />
          <Metric label="Iscrizioni visibili" value={String(registrationsCount ?? 0)} />
        </section>

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
