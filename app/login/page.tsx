import Link from "next/link";

import { getMessages } from "@/lib/i18n/messages";
import { getRequestLocale } from "@/lib/i18n/server";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    redirectedFrom?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const locale = await getRequestLocale();
  const copy = getMessages(locale).login;
  const errorMessage = params.error ? copy.errors[params.error] : null;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-6 py-12">
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
          {copy.eyebrow}
        </p>
        <h1 className="mt-4 text-3xl font-semibold">{copy.title}</h1>
        <p className="mt-4 text-base leading-7 text-zinc-700 dark:text-zinc-300">
          {copy.intro}
        </p>

        {errorMessage ? (
          <div className="mt-6 border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {errorMessage}
          </div>
        ) : null}

        {params.redirectedFrom ? (
          <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
            {copy.redirected}
          </p>
        ) : null}

        <Link
          href="/"
          className="mt-8 inline-flex w-fit items-center border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          {copy.backHome}
        </Link>
      </section>
    </main>
  );
}
