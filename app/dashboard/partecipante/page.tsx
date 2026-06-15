import { redirect } from "next/navigation";

import { getCurrentAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RegistrationRow = {
  id: string;
  status: string;
  submitted_at: string;
  events: Array<{ title: string; slug: string }> | null;
  participants: Array<{
    first_name: string;
    last_name: string;
    public_code: string;
  }> | null;
};

export default async function PartecipanteDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(supabase, "partecipante");

  if (!auth) {
    redirect("/login");
  }

  const { data: registrations } = await supabase
    .from("registrations")
    .select(
      "id,status,submitted_at,events(title,slug),participants!inner(first_name,last_name,public_code)"
    )
    .order("submitted_at", { ascending: false });

  return (
    <main className="min-h-screen bg-[#f7f8f3] text-[#1c241f]">
      <section className="mx-auto grid w-full max-w-5xl gap-6 px-5 py-8 sm:px-8">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#5d765f]">
            Area protetta
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Dashboard partecipante</h1>
          <p className="mt-3 max-w-3xl text-[#4b5a50]">
            Accesso verificato per {auth.user.email}. Questa vista iniziale
            mostra solo le iscrizioni leggibili dalla sessione corrente.
          </p>
        </header>

        <section className="rounded-lg border border-[#d8dece] bg-white p-5">
          <h2 className="text-lg font-semibold">Le tue iscrizioni</h2>
          <div className="mt-4 grid gap-3">
            {((registrations ?? []) as RegistrationRow[]).map((registration) => {
              const participant = registration.participants?.[0];
              const event = registration.events?.[0];

              return (
                <div
                  key={registration.id}
                  className="grid gap-1 border-b border-[#e6eadf] pb-3 last:border-b-0 last:pb-0"
                >
                  <p className="font-medium">
                    {participant?.first_name} {participant?.last_name}
                  </p>
                  <p className="text-sm text-[#5e6d63]">
                    {event?.title ?? "Evento"} - {registration.status}
                  </p>
                  <p className="text-sm text-[#5e6d63]">
                    Codice partecipante:{" "}
                    <span className="font-mono font-semibold text-[#1c241f]">
                      {participant?.public_code}
                    </span>
                  </p>
                </div>
              );
            })}
            {!registrations?.length ? (
              <p className="text-sm text-[#5e6d63]">
                Nessuna iscrizione collegata a questa sessione.
              </p>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}
