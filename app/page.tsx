import { startPublicEmailFlow } from "@/app/actions";
import { getPublicRegistrationOptions } from "@/lib/registrations/public-flow";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

type HomeProps = {
  searchParams: Promise<{
    error?: string;
    sent?: string;
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const options = await getOptionsSafely();

  return (
    <main className="min-h-screen bg-[#f7f8f3] text-[#1c241f]">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center gap-8 px-5 py-10 sm:px-8 lg:px-10">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#5d765f]">
            Iscrizioni e accesso
          </p>
          <h1 className="mt-4 text-4xl font-semibold text-balance sm:text-5xl">
            Iscrizioni Pace
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[#4b5a50]">
            Inserisci la tua email: se hai già un&apos;iscrizione riceverai un
            magic link, altrimenti apriremo il form per una nuova iscrizione.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <form
            action={startPublicEmailFlow}
            className="rounded-lg border border-[#d8dece] bg-white p-5 shadow-sm sm:p-6"
          >
            <label
              htmlFor="email"
              className="text-sm font-medium text-[#38453c]"
            >
              Email
            </label>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="min-h-12 flex-1 rounded-md border border-[#cbd3c0] bg-white px-3 text-base outline-none ring-[#6d8b70] transition focus:ring-2"
                placeholder="nome@example.org"
              />
              <button
                type="submit"
                className="min-h-12 rounded-md bg-[#2f5e46] px-5 font-semibold text-white transition hover:bg-[#254b38]"
              >
                Continua
              </button>
            </div>
            <StatusMessage error={params.error} sent={params.sent} />
          </form>

          <aside className="rounded-lg border border-[#d8dece] bg-[#eef2e7] p-5">
            <h2 className="text-base font-semibold">Evento</h2>
            {options.event ? (
              <div className="mt-3 space-y-2 text-sm text-[#4b5a50]">
                <p className="text-lg font-semibold text-[#1c241f]">
                  {options.event.title}
                </p>
                <p>
                  {options.event.city}, {options.event.country}
                </p>
                <p>
                  {formatDate(options.event.starts_on)}
                  {options.event.ends_on
                    ? ` - ${formatDate(options.event.ends_on)}`
                    : ""}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-[#4b5a50]">
                Nessun evento pubblicato accetta iscrizioni in questo momento.
              </p>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}

function StatusMessage({
  error,
  sent,
}: {
  error?: string;
  sent?: string;
}) {
  if (sent === "magic-link") {
    return (
      <p className="mt-4 rounded-md border border-[#bbd7bd] bg-[#eef8ef] px-3 py-2 text-sm text-[#255532]">
        Ti abbiamo inviato un link di accesso. Controlla la tua email.
      </p>
    );
  }

  if (!error) {
    return null;
  }

  const messages: Record<string, string> = {
    email: "Inserisci un indirizzo email valido.",
    "rate-limit": "Troppi tentativi ravvicinati. Riprova tra qualche minuto.",
    "no-event": "Non ci sono iscrizioni aperte in questo momento.",
  };

  return (
    <p className="mt-4 rounded-md border border-[#e0b5a9] bg-[#fff3ef] px-3 py-2 text-sm text-[#8a3323]">
      {messages[error] ?? "Non e' stato possibile completare la richiesta."}
    </p>
  );
}

async function getOptionsSafely() {
  try {
    return getPublicRegistrationOptions(createSupabaseServiceClient());
  } catch {
    return {
      event: null,
      countries: [],
      cities: [],
      groups: [],
      moments: [],
    };
  }
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Date da definire";
  }

  return new Intl.DateTimeFormat("it", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}
