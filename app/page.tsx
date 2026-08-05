import type { Metadata } from "next";

import { startPublicEmailFlow } from "@/app/actions";
import { EmailAccessForm } from "@/app/email-access-form";
import { PublicPanelProgram } from "@/app/public-panel-program";
import { EventIdentity, PeaceLineMark } from "@/components/event-identity";
import { getMessages } from "@/lib/i18n/messages";
import { getRequestLocale } from "@/lib/i18n/server";
import { getPublicPanelProgram } from "@/lib/panels/public-program";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type HomeProps = {
  searchParams: Promise<{
    error?: string;
    email?: string;
    sent?: string;
  }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const copy = getMessages(locale).panelProgram;

  return {
    title: copy.metadataTitle,
    description: copy.metadataDescription,
  };
}

export default async function Home({ searchParams }: HomeProps) {
  const [params, locale, supabase] = await Promise.all([
    searchParams,
    getRequestLocale(),
    createSupabaseServerClient(),
  ]);
  const copy = getMessages(locale);
  const panels = await getPublicPanelProgram(supabase);

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
            <div className="grid gap-5" id="personal-access">
              <EmailAccessForm
                action={startPublicEmailFlow}
                defaultEmail={params.email ?? ""}
                error={params.error}
                sent={params.sent}
                copy={copy.emailAccess}
              />
            </div>
          </div>
        </div>
      </section>
      <PublicPanelProgram copy={copy.panelProgram} locale={locale} panels={panels} />
      <section className="app-container py-8">
        <div className="h-px bg-gradient-to-r from-transparent via-[var(--peace-sky-400)] to-transparent opacity-70" />
      </section>
    </main>
  );
}
