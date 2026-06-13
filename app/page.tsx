export default function Home() {
  const supabaseUrlConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKeyConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const setupItems = [
    {
      label: "Next.js 16 App Router",
      status: "pronto",
    },
    {
      label: "React 19 e TypeScript strict",
      status: "pronto",
    },
    {
      label: "Tailwind CSS 4",
      status: "pronto",
    },
    {
      label: "Supabase browser/server/service clients",
      status: "base creata",
    },
  ];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center gap-10 px-6 py-12 sm:px-10">
        <div className="max-w-3xl">
          <p className="text-sm font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            Setup tecnico iniziale
          </p>
          <h1 className="mt-4 text-4xl font-semibold text-balance sm:text-5xl">
            Iscrizioni Pace
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-700 dark:text-zinc-300">
            Base Next.js pronta per costruire iscrizioni multi-evento, ruoli,
            gruppi, comunicazioni, QR code e accoglienza.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {setupItems.map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <p className="font-medium">{item.label}</p>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {item.status}
              </p>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-base font-semibold">Configurazione ambiente</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-zinc-600 dark:text-zinc-400">
                NEXT_PUBLIC_SUPABASE_URL
              </dt>
              <dd className="mt-1 font-mono">
                {supabaseUrlConfigured ? "configurata" : "da configurare"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-600 dark:text-zinc-400">
                NEXT_PUBLIC_SUPABASE_ANON_KEY
              </dt>
              <dd className="mt-1 font-mono">
                {supabaseAnonKeyConfigured ? "configurata" : "da configurare"}
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </main>
  );
}
