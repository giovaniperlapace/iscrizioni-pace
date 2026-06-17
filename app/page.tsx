import { startPublicEmailFlow } from "@/app/actions";
import { EmailAccessForm } from "@/app/email-access-form";
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
    <main className="min-h-screen bg-[#f7f8f3] text-[#1c241f]">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center gap-8 px-5 py-10 sm:px-8 lg:px-10">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#5d765f]">
            {copy.home.eyebrow}
          </p>
          <h1 className="mt-4 text-4xl font-semibold text-balance sm:text-5xl">
            {copy.home.title}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[#4b5a50]">
            {copy.home.intro}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <EmailAccessForm
            action={startPublicEmailFlow}
            defaultEmail={params.email ?? ""}
            error={params.error}
            sent={params.sent}
            copy={copy.emailAccess}
          />

          <aside className="rounded-lg border border-[#d8dece] bg-[#eef2e7] p-5">
            <h2 className="text-base font-semibold">{copy.home.eventTitle}</h2>
            {options.event ? (
              <div className="mt-3 space-y-2 text-sm text-[#4b5a50]">
                <p className="text-lg font-semibold text-[#1c241f]">
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
              <p className="mt-3 text-sm leading-6 text-[#4b5a50]">
                {copy.home.noEvent}
              </p>
            )}
          </aside>
        </div>
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
