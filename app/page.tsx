import { startPublicEmailFlow } from "@/app/actions";
import { EmailAccessForm } from "@/app/email-access-form";
import { EventIdentity, PeaceLineMark } from "@/components/event-identity";
import { getMessages } from "@/lib/i18n/messages";
import { getRequestLocale } from "@/lib/i18n/server";
import { getPublicRegistrationOptions } from "@/lib/registrations/public-flow";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

type HomeProps = {
  searchParams: Promise<{
    error?: string;
    email?: string;
    sent?: string;
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const locale = await getRequestLocale();
  const copy = getMessages(locale);
  const options = await getOptionsSafely();

  return (
    <main className="app-page text-[var(--peace-ink)]">
      <section className="event-gradient relative isolate overflow-hidden">
        <PeaceLineMark className="absolute left-[78%] top-24 -z-10 h-36 w-[38rem] -translate-x-1/2 text-white/55 opacity-[0.18] sm:left-[72%] sm:top-28 sm:h-52 sm:opacity-20 lg:left-[68%] lg:w-[58rem] lg:opacity-[0.45]" />
        <div className="app-container flex min-h-[calc(100vh-4.75rem)] flex-col justify-center gap-8 py-10 sm:py-14 lg:py-16">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
            <div>
              <EventIdentity inverted />
              <p className="mt-7 max-w-2xl text-base leading-8 text-white/84 sm:text-lg">
                {copy.home.intro}
              </p>
            </div>
            <div className="grid gap-5">
              <EmailAccessForm
                action={startPublicEmailFlow}
                defaultEmail={params.email ?? ""}
                error={params.error}
                sent={params.sent}
                copy={copy.emailAccess}
              />

              <aside className="surface-card p-5">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-base font-extrabold text-[var(--peace-blue-900)]">
                    {copy.home.eventTitle}
                  </h2>
                  <span className="event-kicker text-[0.62rem]">40 Spirit of Assisi</span>
                </div>
                {options.event ? (
                  <div className="mt-4 space-y-2 text-sm text-[var(--peace-muted)]">
                    <p className="text-lg font-bold text-[var(--peace-ink)]">
                      {options.event.title}
                    </p>
                    <p>
                      {options.event.city}, {options.event.country}
                    </p>
                    <p>
                      {formatDate(options.event.starts_on, locale, copy.common.dateToBeDefined)}
                      {options.event.ends_on
                        ? ` - ${formatDate(options.event.ends_on, locale, copy.common.dateToBeDefined)}`
                        : ""}
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-[var(--peace-muted)]">
                    {copy.home.noEvent}
                  </p>
                )}
              </aside>
            </div>
          </div>
        </div>
      </section>
      <section className="app-container py-8">
        <div className="h-px bg-gradient-to-r from-transparent via-[var(--peace-sky-400)] to-transparent opacity-70" />
      </section>
    </main>
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

function formatDate(
  value: string | null,
  locale: string,
  fallback: string
): string {
  if (!value) {
    return fallback;
  }

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}
