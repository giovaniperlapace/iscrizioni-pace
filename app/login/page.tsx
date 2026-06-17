import Link from "next/link";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    redirectedFrom?: string;
  }>;
};

const ERROR_MESSAGES: Record<string, string> = {
  code: "Il codice di accesso non e' valido o e' scaduto.",
  otp: "Il link di accesso non e' valido o e' scaduto.",
  profile: "Sessione creata, ma non e' stato possibile aggiornare il profilo.",
  session: "Non e' stato possibile creare una sessione valida.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const errorMessage = params.error ? ERROR_MESSAGES[params.error] : null;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-6 py-12">
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
          Accesso
        </p>
        <h1 className="mt-4 text-3xl font-semibold">Accedi a Iscrizioni Pace</h1>
        <p className="mt-4 text-base leading-7 text-zinc-700 dark:text-zinc-300">
          Usa il link ricevuto via email per entrare nella tua area personale.
          Se il link non funziona, torna alla home e richiedine uno nuovo.
        </p>

        {errorMessage ? (
          <div className="mt-6 border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {errorMessage}
          </div>
        ) : null}

        {params.redirectedFrom ? (
          <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
            Per aprire la tua area personale accedi dal link ricevuto via email.
          </p>
        ) : null}

        <Link
          href="/"
          className="mt-8 inline-flex w-fit items-center border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Torna alla home
        </Link>
      </section>
    </main>
  );
}
