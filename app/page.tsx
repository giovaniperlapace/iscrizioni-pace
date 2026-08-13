import type { Metadata } from "next";
import { ArrowDown } from "lucide-react";

import { startPublicEmailFlow } from "@/app/actions";
import { EmailAccessForm } from "@/app/email-access-form";
import { PublicPanelProgram } from "@/app/public-panel-program";
import { EventIdentity, PeaceLineMark } from "@/components/event-identity";
import { getMessages } from "@/lib/i18n/messages";
import { getRequestLocale } from "@/lib/i18n/server";
import { getPublicPanelProgram } from "@/lib/panels/public-program";
import { getSchoolBookingCopy } from "@/lib/panels/school-booking-copy";
import Link from "next/link";
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
  const schoolCopy = getSchoolBookingCopy(locale);
  const panels = await getPublicPanelProgram(supabase);

  return (
    <main className="app-page text-[var(--peace-ink)]">
      <section className="event-gradient relative isolate scroll-mt-[4.75rem] overflow-hidden" id="personal-access">
        <PeaceLineMark className="absolute left-[78%] top-24 -z-10 h-36 w-[38rem] -translate-x-1/2 text-white/55 opacity-[0.18] sm:left-[72%] sm:top-28 sm:h-52 sm:opacity-20 lg:left-[68%] lg:w-[58rem] lg:opacity-[0.45]" />
        <div className="app-container flex min-h-[calc(100vh-4.75rem)] flex-col py-10 sm:py-12 lg:py-14">
          <div className="grid flex-1 content-center gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
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
            </div>
          </div>
          <a
            className="panel-scroll-cue group relative mx-auto mt-9 flex min-h-14 items-center gap-3 overflow-hidden rounded-full border border-white/24 bg-white/10 py-2 pl-5 pr-2 text-sm font-bold text-white shadow-[0_12px_30px_rgba(3,28,58,0.22)] backdrop-blur-sm sm:mt-10 sm:text-base"
            href="#panel-program"
          >
            <PeaceLineMark className="absolute -left-20 top-1/2 h-20 w-64 -translate-y-1/2 text-white opacity-[0.08] transition-opacity duration-200 group-hover:opacity-[0.16]" />
            <span className="relative">{copy.home.panelDiscovery}</span>
            <span className="panel-scroll-cue__arrow relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[var(--peace-blue-900)] shadow-sm">
              <ArrowDown aria-hidden="true" className="h-5 w-5" strokeWidth={2.5} />
            </span>
          </a>
        </div>
      </section>
      <PublicPanelProgram copy={copy.panelProgram} locale={locale} panels={panels} />
      <section className="app-container py-8" id="schools"><div className="rounded-xl border border-[var(--peace-border)] bg-white p-6 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-6"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--peace-blue-700)]">{schoolCopy.homeTitle}</p><h2 className="mt-2 text-2xl font-semibold">{schoolCopy.title}</h2><p className="mt-2 max-w-2xl leading-7 text-[var(--peace-muted)]">{schoolCopy.homeBody}</p></div><Link href="/scuole" className="mt-5 inline-flex min-h-12 shrink-0 items-center rounded-md bg-[var(--peace-blue-800)] px-5 font-semibold text-white sm:mt-0">{schoolCopy.homeCta}</Link></div></section>
      <section className="app-container py-8">
        <div className="h-px bg-gradient-to-r from-transparent via-[var(--peace-sky-400)] to-transparent opacity-70" />
      </section>
    </main>
  );
}
