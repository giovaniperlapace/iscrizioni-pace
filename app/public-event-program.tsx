import { ArrowDown, CalendarDays, Clock3, MapPin } from "lucide-react";
import type { SupportedLocale } from "@/lib/i18n/config";
import { EVENT_PROGRAM_SOURCE, getHomeProgramDays } from "@/lib/events/home-program";
import { getMessages } from "@/lib/i18n/messages";
import { getEventProgramCopy } from "@/lib/events/program-copy";
import { formatPanelProgramDay, type PublicPanelProgramItem } from "@/lib/panels/public-program";

export function PublicEventProgram({ locale, panels }: { locale: SupportedLocale; panels: PublicPanelProgramItem[] }) {
  const copy = getEventProgramCopy(locale);
  const programme = getHomeProgramDays(locale, panels);
  const time = (value: string) => new Intl.DateTimeFormat(locale, { timeZone: "Europe/Rome", hour: "numeric", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));
  return (
    <section id="event-program" aria-labelledby="event-program-title" className="app-container scroll-mt-20 py-12 sm:py-16">
      <div className="mx-auto max-w-5xl">
        <p className="event-kicker">Assisi 2026</p>
        <h2 id="event-program-title" className="mt-3 text-3xl font-extrabold tracking-tight text-[var(--peace-blue-950)] sm:text-4xl">{copy.title}</h2>
        <p className="mt-4 text-base leading-7 text-[var(--peace-muted)] sm:text-lg">{copy.intro}</p>
        <ol className="mt-8 grid gap-5 lg:grid-cols-3">
          {programme.map(day => (
            <li key={day.key} className="surface-card flex flex-col p-6 sm:p-7">
              <h3 className="flex items-start gap-2 text-lg font-extrabold text-[var(--peace-blue-800)]"><CalendarDays className="mt-1 size-5 shrink-0" aria-hidden="true" /><span className="first-letter:uppercase">{formatPanelProgramDay(day.startsAt, locale)}</span></h3>
              <ol className="mt-6 divide-y divide-[var(--peace-border)]">
                {day.items.map(item => (
                  <li key={item.id} className="py-6 first:pt-0 last:pb-0">
                    <p className="flex items-center gap-2 text-sm font-bold text-[var(--peace-blue-800)]"><Clock3 className="size-4 shrink-0" aria-hidden="true" /><span><time dateTime={item.startsAt}>{time(item.startsAt)}</time>{item.endsAt ? <>–<time dateTime={item.endsAt}>{time(item.endsAt)}</time></> : null}</span></p>
                    <h4 className="mt-4 text-lg font-extrabold leading-snug text-[var(--peace-ink)]">{item.title}</h4>
                    {item.isPanelSlot ? <a href={`#${item.id}`} className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[var(--peace-blue-800)]">{copy.panels}<ArrowDown className="size-4" aria-hidden="true" /></a> : <p className="mt-4 flex items-start gap-2.5 text-sm leading-7 text-[var(--peace-muted)]"><MapPin className="mt-1 size-4 shrink-0 text-[var(--peace-blue-700)]" aria-hidden="true" />{item.location}</p>}
                  </li>
                ))}
              </ol>
              {day.items.length === 0 ? <p className="mt-4 text-sm leading-6 text-[var(--peace-muted)]">{getMessages(locale).panelProgram.empty}</p> : null}
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-sm font-bold text-[var(--peace-blue-800)]">
          <a href={EVENT_PROGRAM_SOURCE} className="underline underline-offset-4">{copy.source}</a>
        </div>
      </div>
    </section>
  );
}
