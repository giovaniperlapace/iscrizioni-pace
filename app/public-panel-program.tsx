import { CalendarDays, CheckCircle2, Clock3, LockKeyhole, MapPin, XCircle } from "lucide-react";

import type { SupportedLocale } from "@/lib/i18n/config";
import type { getMessages } from "@/lib/i18n/messages";
import {
  formatPanelProgramDay,
  formatPanelProgramTimeRange,
  groupPublicPanelsByDay,
  type PublicPanelAvailability,
  type PublicPanelProgramItem,
} from "@/lib/panels/public-program";

type PublicPanelProgramProps = {
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

export function PublicPanelProgram({ locale, panels, copy }: PublicPanelProgramProps) {
  const groups = groupPublicPanelsByDay(panels);

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

        {groups.length === 0 ? (
          <div className="surface-card mt-8 flex items-start gap-3 p-5 sm:p-6">
            <CalendarDays aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[var(--peace-blue-700)]" />
            <p className="leading-7 text-[var(--peace-muted)]">{copy.empty}</p>
          </div>
        ) : (
          <div className="mt-10 space-y-10">
            {groups.map((group) => (
              <section aria-labelledby={`panel-day-${group.key}`} key={group.key}>
                <h3 id={`panel-day-${group.key}`} className="flex items-center gap-3 text-xl font-extrabold text-[var(--peace-blue-900)] sm:text-2xl">
                  <CalendarDays aria-hidden="true" className="h-5 w-5 shrink-0 text-[var(--peace-sky-400)]" />
                  <span className="first-letter:uppercase">
                    {formatPanelProgramDay(group.startsAt, locale)}
                  </span>
                </h3>
                <ol className="mt-4 grid gap-4 lg:grid-cols-2">
                  {group.panels.map((panel) => (
                    <li className="surface-card flex h-full flex-col p-5 sm:p-6" key={panel.id}>
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
                      <h4 className="mt-4 break-words text-xl font-extrabold leading-tight text-[var(--peace-ink)]">
                        {panel.title}
                      </h4>
                      {panel.description ? (
                        <p className="mt-3 whitespace-pre-line break-words text-sm leading-6 text-[var(--peace-muted)]">
                          {panel.description}
                        </p>
                      ) : null}
                      <address className="mt-auto flex min-w-0 gap-2 break-words pt-5 text-sm not-italic leading-6 text-[var(--peace-ink)]">
                        <MapPin aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-[var(--peace-blue-700)]" />
                        <span>
                          <span className="sr-only">{copy.locationLabel}: </span>
                          <strong>{panel.locationName}</strong>
                          {panel.locationAddress ? <span className="block text-[var(--peace-muted)]">{panel.locationAddress}</span> : null}
                        </span>
                      </address>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        )}

        <div className="mt-12 border-t border-[var(--peace-border)] pt-8 text-center sm:mt-16 sm:pt-10">
          <a className="btn-primary inline-flex max-w-full items-center justify-center px-5 py-3 text-center" href="#personal-access">
            {copy.accessCta}
          </a>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[var(--peace-muted)]">
            {copy.accessHint}
          </p>
        </div>
      </div>
    </section>
  );
}
