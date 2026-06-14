import Link from "next/link";

type DashboardPlaceholderProps = {
  title: string;
  description: string;
};

export function DashboardPlaceholder({
  title,
  description,
}: DashboardPlaceholderProps) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center gap-6 px-6 py-12">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            Area protetta
          </p>
          <h1 className="mt-4 text-3xl font-semibold">{title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-700 dark:text-zinc-300">
            {description}
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex w-fit items-center border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Vai alla dashboard predefinita
        </Link>
      </section>
    </main>
  );
}
