import { ArrowUp, CalendarDays, CheckCircle2, Clock3, LockKeyhole, MapPin, XCircle } from "lucide-react";

import { forumBookingPath } from "@/lib/panels/booking-intent";
import { getHomePanelSlots } from "@/lib/events/home-program";
import { getEventProgramCopy } from "@/lib/events/program-copy";
import { PeaceLineMark } from "@/components/event-identity";
import type { SupportedLocale } from "@/lib/i18n/config";
import type { getMessages } from "@/lib/i18n/messages";
import {
  formatPanelProgramDay,
  formatPanelProgramTimeRange,
  getPanelProgramDayKey,
  type PublicPanelAvailability,
  type PublicPanelProgramItem,
} from "@/lib/panels/public-program";

type PublicPanelProgramProps = {
  preview?: boolean;
  authenticated?: boolean;
  onSelectPanel?: (id: string) => void;
  bookingsOpen?: boolean;
  showAccessCta?: boolean;
  locale: SupportedLocale;
  panels: PublicPanelProgramItem[];
  copy: ReturnType<typeof getMessages>["panelProgram"];
};

const availabilityStyles: Record<PublicPanelAvailability, string> = {
  available: "border-emerald-200 bg-emerald-50 text-emerald-800",
  full: "border-red-200 bg-red-50 text-red-800",
  unavailable: "border-slate-200 bg-slate-100 text-slate-700",
};

function AvailabilityIcon({ availability }: { availability: PublicPanelAvailability }) {
  if (availability === "available") {
    return <CheckCircle2 aria-hidden="true" className="h-4 w-4" />;
  }

  if (availability === "full") {
    return <XCircle aria-hidden="true" className="h-4 w-4" />;
  }

  return <LockKeyhole aria-hidden="true" className="h-4 w-4" />;
}

export function PublicPanelProgram({ locale, panels, copy, bookingsOpen = true, showAccessCta = bookingsOpen, preview = false, authenticated = false, onSelectPanel }: PublicPanelProgramProps) {
  const slots = getHomePanelSlots(panels);
  const days = [...new Set(slots.map(slot => getPanelProgramDayKey(slot.startsAt)))];
  const programCopy = getEventProgramCopy(locale);

  return (
    <section aria-labelledby="panel-program-title" className="app-container scroll-mt-20 py-12 sm:py-16 lg:py-20" id="panel-program">
      <div className="mx-auto max-w-5xl">
        <p className="event-kicker">{copy.eyebrow}</p>
        <div className="mt-3">
          <h2 id="panel-program-title" className="text-3xl font-extrabold tracking-tight text-[var(--peace-blue-950)] sm:text-4xl">
            {copy.title}
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--peace-muted)] sm:text-lg">
            {copy.intro}
          </p>
        </div>

        {days.length === 0 ? (
          <div className="surface-card mt-8 flex items-start gap-3 p-5 sm:p-6">
            <CalendarDays aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[var(--peace-blue-700)]" />
            <p className="leading-7 text-[var(--peace-muted)]">{copy.empty}</p>
          </div>
        ) : (
          <div className="mt-10 space-y-10">
            {days.map((day) => (
              <section aria-labelledby={`panel-day-${day}`} key={day}>
                <h3 id={`panel-day-${day}`} className="flex items-center gap-3 text-xl font-extrabold text-[var(--peace-blue-900)] sm:text-2xl">
                  <CalendarDays aria-hidden="true" className="h-5 w-5 shrink-0 text-[var(--peace-sky-400)]" />
                  <span className="first-letter:uppercase">
                    {formatPanelProgramDay(slots.find(slot => getPanelProgramDayKey(slot.startsAt) === day)!.startsAt, locale)}
                  </span>
                </h3>
                {slots.filter(slot => getPanelProgramDayKey(slot.startsAt) === day).map(slot => (
                  <section id={slot.id} key={slot.id} aria-labelledby={`${slot.id}-title`} className="mt-6 scroll-mt-24">
                    <h4 id={`${slot.id}-title`} className="flex items-center gap-2 text-lg font-bold text-[var(--peace-blue-800)]">
                      <Clock3 aria-hidden="true" className="size-4" />
                      {formatPanelProgramTimeRange(slot.startsAt, slot.endsAt!, locale)}
                    </h4>
                    <ol className="mt-4 grid gap-4 lg:grid-cols-2">
                      {slot.panels.map((panel) => (
                        <li className="surface-card flex h-full flex-col p-5 sm:p-6" id={`public-forum-${panel.id}`} key={panel.id}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <p className="flex items-center gap-2 text-sm font-bold text-[var(--peace-blue-800)]">
                              <Clock3 aria-hidden="true" className="h-4 w-4" />
                              <time dateTime={panel.startsAt}>
                                {formatPanelProgramTimeRange(panel.startsAt, panel.endsAt, locale)}
                              </time>
                            </p>
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${availabilityStyles[panel.availability]}`}>
                              <AvailabilityIcon availability={panel.availability} />
                              {copy.availability[panel.availability]}
                            </span>
                          </div>
                          {panel.publicationStatus === "draft" ? <span className="mt-3 w-fit rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900">{programCopy.draft}</span> : null}
                          <h5 className="mt-4 break-words text-xl font-extrabold leading-tight text-[var(--peace-ink)]">
                            {panel.title}
                          </h5>
                          {panel.description ? (
                            <p className="mt-3 whitespace-pre-line break-words text-sm leading-6 text-[var(--peace-muted)]">
                              {panel.description}
                            </p>
                          ) : null}
                          {panel.remainingSeats !== undefined ? <p className="mt-3 text-sm font-semibold text-[var(--peace-blue-800)]">{programCopy.seats}: {panel.remainingSeats}</p> : null}
                          <address className="mt-auto flex min-w-0 gap-2 break-words pt-5 text-sm not-italic leading-6 text-[var(--peace-ink)]">
                            <MapPin aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-[var(--peace-blue-700)]" />
                            <span>
                              <span className="sr-only">{copy.locationLabel}: </span>
                              <strong>{panel.locationName}</strong>
                              {panel.locationAddress ? <span className="block text-[var(--peace-muted)]">{panel.locationAddress}</span> : null}
                            </span>
                          </address>
                          {panel.availability === "full" ? <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                            <p className="font-bold">{programCopy.waitlistStatus}</p>
                            <p className="mt-1">{programCopy.waitlistInstruction}</p>
                          </div> : null}
                          {showAccessCta && panel.availability === "available" ? <div className="mt-5 border-t border-[var(--peace-border)] pt-5">
                            <a className="btn-primary flex min-h-12 w-full items-center justify-center px-4 text-center" aria-label={`${programCopy.bookForum}: ${panel.title}`}
                              href={authenticated && !preview ? forumBookingPath(panel.id) : preview ? `?forum=${encodeURIComponent(panel.id)}#forum-access-form` : `/forum/${encodeURIComponent(panel.id)}`}
                              onClick={onSelectPanel && (!authenticated || preview) ? event => { event.preventDefault(); onSelectPanel(panel.id); } : undefined}>
                              {programCopy.bookForum}
                            </a>
                          </div> : null}
                        </li>
                      ))}
                    </ol>
                  </section>
                ))}
              </section>
            ))}
          </div>
        )}

        {showAccessCta ? <div className="mt-12 border-t border-[var(--peace-border)] pt-8 text-center sm:mt-16 sm:pt-10">
          <a
            aria-describedby="panel-access-instructions"
            className="panel-access-cue group relative inline-flex min-h-14 max-w-full items-center gap-3 overflow-hidden rounded-full border border-[var(--peace-blue-700)] bg-[var(--peace-blue-900)] py-2 pl-5 pr-2 text-left text-sm font-bold text-white shadow-[0_12px_30px_rgba(8,47,95,0.18)] sm:text-base"
            href="#panel-access-instructions"
          >
            <PeaceLineMark className="absolute -left-20 top-1/2 h-20 w-64 -translate-y-1/2 text-white opacity-[0.08] transition-opacity duration-200 group-hover:opacity-[0.16]" />
            <span className="relative">{programCopy.accessCta}</span>
            <span className="panel-access-cue__arrow relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[var(--peace-blue-900)] shadow-sm">
              <ArrowUp aria-hidden="true" className="h-5 w-5" strokeWidth={2.5} />
            </span>
          </a>
        </div> : null}
      </div>
    </section>
  );
}
