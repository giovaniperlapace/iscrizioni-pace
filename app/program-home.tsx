"use client";

import { useEffect, useState } from "react";
import { ArrowDown } from "lucide-react";

import { startPublicEmailFlow } from "@/app/actions";
import { EmailAccessForm } from "@/app/email-access-form";
import { PublicPanelProgram } from "@/app/public-panel-program";
import { EventIdentity, PeaceLineMark } from "@/components/event-identity";
import { getMessages } from "@/lib/i18n/messages";
import type { PublicPanelProgramItem } from "@/lib/panels/public-program";
import type { SupportedLocale } from "@/lib/i18n/config";
import { PublicEventProgram } from "@/app/public-event-program";
import { getEventProgramCopy } from "@/lib/events/program-copy";
import { getSchoolBookingCopy } from "@/lib/panels/school-booking-copy";
import Link from "next/link";

type ProgramHomeProps = {
  locale: SupportedLocale;
  panels: PublicPanelProgramItem[];
  bookingsOpen: boolean;
  preview?: boolean;
  email?: string;
  error?: string;
  sent?: string;
  forum?: string;
  authenticated?: boolean;
};

export function ProgramHome({ locale, panels, bookingsOpen, preview = false, email = "", error, sent, forum, authenticated = false }: ProgramHomeProps) {
  const [selectedId, setSelectedId] = useState(forum);
  const selectedPanel = panels.find(panel => panel.id === selectedId);
  useEffect(() => {
    if (forum && selectedPanel && !preview && bookingsOpen) document.getElementById("email")?.focus({ preventScroll: true });
  }, [forum, selectedPanel, preview, bookingsOpen]);
  const selectPanel = (id: string) => {
    setSelectedId(id);
    if (!preview) {
      const url = new URL(window.location.href);
      url.searchParams.set("forum", id);
      url.hash = "forum-access-form";
      window.history.replaceState(window.history.state, "", url);
    }
    requestAnimationFrame(() => {
      document.getElementById("forum-access-form")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "center" });
      if (!preview) document.getElementById("email")?.focus({ preventScroll: true });
    });
  };
  const copy = getMessages(locale);
  const schoolCopy = getSchoolBookingCopy(locale);
  const programCopy = getEventProgramCopy(locale);

  return (
    <main className="app-page text-[var(--peace-ink)]">
      {preview ? <aside className="app-container py-4"><p className="surface-card p-4 text-sm leading-6">{programCopy.preview}</p></aside> : null}
      <section className="event-gradient relative isolate scroll-mt-[4.75rem] overflow-hidden" id="personal-access">
        <PeaceLineMark className="absolute left-[78%] top-24 -z-10 h-36 w-[38rem] -translate-x-1/2 text-white/55 opacity-[0.18] sm:left-[72%] sm:top-28 sm:h-52 sm:opacity-20 lg:left-[68%] lg:w-[58rem] lg:opacity-[0.45]" />
        <div className="app-container flex min-h-[calc(100vh-4.75rem)] flex-col py-10 sm:py-12 lg:py-14">
          <div className="grid flex-1 content-center gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
            <div>
              <EventIdentity inverted />
              <p id="panel-access-instructions" className="mt-7 max-w-2xl text-base leading-8 text-white/84 sm:text-lg">
                {programCopy.accessInstruction}
              </p>
              <p className="mt-5 max-w-2xl rounded-xl bg-white p-4 text-base font-bold leading-7 text-[var(--peace-blue-950)] shadow-sm sm:text-lg">
                {programCopy.bookingInstruction}
              </p>
            </div>
            <div id="forum-access-form" className="grid scroll-mt-24 gap-5">
              {selectedPanel ? <div role="status" className="rounded-xl border border-white/40 bg-white/15 p-5 text-white">
                <p className="text-sm font-semibold">{programCopy.selectedForum}</p>
                <p className="mt-2 text-xl font-extrabold">{selectedPanel.title}</p>
                <p className="mt-3 text-sm leading-6">{programCopy.selectedInstruction}</p>
              </div> : null}
              <fieldset disabled={preview} aria-label={preview ? programCopy.preview : undefined}>
                <EmailAccessForm
                  action={startPublicEmailFlow}
                  defaultEmail={email}
                  forum={selectedPanel?.id}
                  error={error}
                  sent={sent}
                  copy={copy.emailAccess}
                />
              </fieldset>
            </div>
          </div>
          <a
            className="panel-scroll-cue group relative mx-auto mt-9 flex min-h-14 items-center gap-3 overflow-hidden rounded-full border border-white/24 bg-white/10 py-2 pl-5 pr-2 text-sm font-bold text-white shadow-[0_12px_30px_rgba(3,28,58,0.22)] backdrop-blur-sm sm:mt-10 sm:text-base"
            href="#event-program"
          >
            <PeaceLineMark className="absolute -left-20 top-1/2 h-20 w-64 -translate-y-1/2 text-white opacity-[0.08] transition-opacity duration-200 group-hover:opacity-[0.16]" />
            <span className="relative">{programCopy.discovery}</span>
            <span className="panel-scroll-cue__arrow relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[var(--peace-blue-900)] shadow-sm">
              <ArrowDown aria-hidden="true" className="h-5 w-5" strokeWidth={2.5} />
            </span>
          </a>
        </div>
      </section>
      <PublicEventProgram locale={locale} panels={panels} />
      <PublicPanelProgram preview={preview} authenticated={authenticated} onSelectPanel={selectPanel} showAccessCta={preview || bookingsOpen} bookingsOpen={bookingsOpen} copy={copy.panelProgram} locale={locale} panels={panels} />
      {bookingsOpen ? <section className="app-container py-8" id="schools"><div className="rounded-xl border border-[var(--peace-border)] bg-white p-6 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-6"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--peace-blue-700)]">{schoolCopy.homeTitle}</p><h2 className="mt-2 text-2xl font-semibold">{schoolCopy.title}</h2><p className="mt-2 max-w-2xl leading-7 text-[var(--peace-muted)]">{schoolCopy.homeBody}</p></div><Link href="/scuole" className="mt-5 inline-flex min-h-12 shrink-0 items-center rounded-md bg-[var(--peace-blue-800)] px-5 font-semibold text-white sm:mt-0">{schoolCopy.homeCta}</Link></div></section> : null}
      <section className="app-container py-8">
        <div className="h-px bg-gradient-to-r from-transparent via-[var(--peace-sky-400)] to-transparent opacity-70" />
      </section>
    </main>
  );
}
