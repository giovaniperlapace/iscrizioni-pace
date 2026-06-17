import Link from "next/link";

import { EventIdentity } from "@/components/event-identity";
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
    <main className="app-page text-[var(--peace-ink)]">
      <section className="app-container flex min-h-[calc(100vh-4.75rem)] flex-col justify-center py-10">
        <div className="surface-card mx-auto w-full max-w-3xl overflow-hidden">
          <div className="event-gradient px-6 py-7">
            <EventIdentity compact inverted />
          </div>
          <div className="p-6 sm:p-8">
        <p className="text-sm font-bold uppercase tracking-wide text-[var(--peace-blue-800)]">
          {copy.eyebrow}
        </p>
        <h2 className="mt-4 text-3xl font-semibold">{copy.title}</h2>
        <p className="mt-4 text-base leading-7 text-[var(--peace-muted)]">
          {copy.intro}
        </p>

        {errorMessage ? (
          <div className="status-error mt-6 rounded-[var(--radius-sm)] border p-4 text-sm">
            {errorMessage}
          </div>
        ) : null}

        {params.redirectedFrom ? (
          <p className="mt-6 text-sm text-[var(--peace-muted)]">
            {copy.redirected}
          </p>
        ) : null}

        <Link
          href="/"
          className="btn-secondary mt-8 inline-flex w-fit items-center px-4 py-2 text-sm"
        >
          {copy.backHome}
        </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
