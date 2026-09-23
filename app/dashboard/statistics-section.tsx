"use client";

import Link from "@/components/pending-link";
import {
  Baby,
  ChevronRight,
  ChevronDown,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Fragment, type ReactNode, useMemo, useState } from "react";

import {
  serializeStatisticsDrilldown,
  buildAssignedGroupTree,
  type EventStatisticsSnapshot,
  type StatisticsAgeBand,
  type StatisticsAttendanceSlot,
  type StatisticsDrilldownFilter,
  type StatisticsPersonRow,
} from "@/lib/registrations/event-statistics";

type StatisticsDashboard = "admin" | "manager";
type StatisticsNavMode = "full" | "mini";

type StatisticsSectionProps = {
  statistics: EventStatisticsSnapshot;
  dashboard: StatisticsDashboard;
  navMode: StatisticsNavMode;
};

type AssignedGroupRow = ReturnType<typeof buildAssignedGroupTree>[number];

const AGE_BANDS: StatisticsAgeBand[] = [
  "0-14",
  "15-30",
  "30-65",
  "65+",
  "unknown",
];

export function StatisticsSection({
  statistics,
  dashboard,
  navMode,
}: StatisticsSectionProps) {
  const participantHref = (filter: StatisticsDrilldownFilter) =>
    buildParticipantsHref(dashboard, navMode, filter);

  return (
    <section className="grid w-full min-w-0 gap-8">
      <div className="surface-panel p-5">
        <h2 className="text-lg font-semibold">Statistiche evento</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--peace-muted)]">
          Seleziona qualsiasi conteggio per aprire la gestione iscritti già
          filtrata sulle persone che compongono quel dato.
        </p>
      </div>

      <ReportBlock name="territory" title="Partecipanti per gruppo o nodo">
        <TerritoryStatisticsSummary
          statistics={statistics}
          participantHref={participantHref}
        />

        <TerritoryAttendancePivot
          people={statistics.people}
          attendanceSlots={statistics.attendanceSlots}
          participantHref={participantHref}
        />
      </ReportBlock>

      <ReportBlock name="attendance" title="Presenze previste">
        <AttendanceStatisticsSummary
          statistics={statistics}
          participantHref={participantHref}
        />
      </ReportBlock>

      <ReportBlock name="age" title="Fasce di età">
        <AgeStatisticsSummary
          statistics={statistics}
          participantHref={participantHref}
        />
      </ReportBlock>

      <ReportBlock name="registrations" title="Iscrizioni per settimana">
        <WeeklyRegistrations statistics={statistics} />
      </ReportBlock>
    </section>
  );
}

function ReportBlock({
  name,
  title,
  children,
}: {
  name: "territory" | "attendance" | "age" | "registrations";
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      data-statistics-report={name}
      aria-label={`Report: ${title}`}
      className="relative grid w-full min-w-0 max-w-full gap-4 overflow-visible rounded-2xl border-2 border-[#bfd8ea] bg-[#eef7fc] p-3 shadow-[0_14px_34px_rgba(23,72,112,0.10)] sm:p-5"
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1.5 bg-[var(--peace-blue-800)]"
      />
      <header className="flex items-center gap-3 px-2 sm:px-1">
        <span className="rounded-full bg-[var(--peace-blue-800)] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-white">
          Report
        </span>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--peace-blue-900)]">
          {title}
        </h3>
      </header>
      {children}
    </section>
  );
}

function TerritoryStatisticsSummary({
  statistics,
  participantHref,
}: {
  statistics: EventStatisticsSnapshot;
  participantHref: (filter: StatisticsDrilldownFilter) => string;
}) {
  return (
    <article className="min-w-0 max-w-full rounded-lg border border-[var(--peace-border)] bg-white p-5">
      <div>
        <h3 className="text-base font-semibold">
          Riepilogo partecipanti
        </h3>
        <p className="mt-1 text-sm leading-6 text-[var(--peace-muted)]">
          Ogni conteggio apre l’elenco delle iscrizioni corrispondenti.
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <SummaryKpi
          icon={Users}
          label="Persone complessive"
          value={statistics.summary.totalPeople}
          href={participantHref({ personKind: "all" })}
        />
        <SummaryKpi
          icon={UserRound}
          label="Partecipanti iscritti"
          value={statistics.summary.registeredParticipants}
          href={participantHref({ personKind: "participant" })}
        />
        <SummaryKpi
          icon={Baby}
          label="Minori accompagnati"
          value={statistics.summary.accompanyingChildren}
          href={participantHref({ personKind: "child" })}
        />
      </div>

    </article>
  );
}

function TerritoryAttendancePivot({
  people,
  attendanceSlots,
  participantHref,
}: {
  people: StatisticsPersonRow[];
  attendanceSlots: StatisticsAttendanceSlot[];
  participantHref: (filter: StatisticsDrilldownFilter) => string;
}) {
  const rows = useMemo(() => buildAssignedGroupTree(people), [people]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const toggle = (key: string) => setExpanded(current => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const renderRow = (row: AssignedGroupRow, depth = 0): ReactNode => (
    <Fragment key={row.key}>
      <TerritoryPivotTableRow row={row} depth={depth} expanded={expanded.has(row.key)} onToggle={() => toggle(row.key)} attendanceSlots={attendanceSlots} participantHref={participantHref} />
      {expanded.has(row.key) ? row.children.map(child => renderRow(child, depth + 1)) : null}
    </Fragment>
  );

  return (
    <article className="min-w-0 max-w-full rounded-lg border border-[var(--peace-border)] bg-white p-5">
      <div>
        <h3 className="text-base font-semibold">Partecipanti per gruppo o nodo</h3>
        <p className="mt-1 text-sm leading-6 text-[var(--peace-muted)]">
          Espandi i nodi per vedere i sottogruppi. Ogni totale include gli iscritti
          al nodo e a tutti i suoi sottogruppi, inclusi i minori accompagnati.
          Le colonne mostrano le presenze previste per mattina e pomeriggio.
          Sono segnalate anche le persone senza gruppo o assegnate a nodi non iscrivibili.
        </p>
      </div>

      <div className="mt-5 min-w-0 max-w-full overflow-x-auto overscroll-x-contain rounded-md border border-[var(--peace-border)]">
        {/* Separate cell borders avoid WebKit painting issues with sticky table cells. */}
        <table className="isolate w-full min-w-max border-separate border-spacing-0 text-left text-sm">
          <thead className="bg-[#f7fbfe]">
            <tr className="text-xs uppercase tracking-wide text-[#6f7f91] [&>th]:border-b [&>th]:border-[var(--peace-border)]">
              <th className="sm:sticky left-0 z-20 min-w-48 sm:min-w-64 bg-[#f7fbfe] px-4 py-3 font-semibold">
                Gruppo o nodo
              </th>
              <th className="min-w-24 px-3 py-3 text-center font-semibold">
                Totale
              </th>
              {attendanceSlots.map((slot) => (
                <th
                  key={slot.key}
                  className="min-w-28 px-3 py-3 text-center font-semibold"
                >
                  <span className="block normal-case tracking-normal">
                    {attendancePartLabel(slot.dayPart)}
                  </span>
                  <span className="mt-0.5 block">{formatShortDate(slot.day)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => renderRow(row))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--peace-muted)]">
          Nessuna assegnazione disponibile.
        </p>
      ) : null}
    </article>
  );
}

function TerritoryPivotTableRow({
  row,
  depth,
  expanded,
  onToggle,
  attendanceSlots,
  participantHref,
}: {
  row: AssignedGroupRow;
  depth: number;
  expanded: boolean;
  onToggle: () => void;
  attendanceSlots: StatisticsAttendanceSlot[];
  participantHref: (filter: StatisticsDrilldownFilter) => string;
}) {
  return (
    <tr className={`[&>th]:border-b [&>td]:border-b [&>th]:border-[var(--peace-border)] [&>td]:border-[var(--peace-border)] last:[&>th]:border-b-0 last:[&>td]:border-b-0 bg-white`}>
      <th
        scope="row"
        className={`sm:sticky left-0 z-[5] min-w-48 sm:min-w-64 py-3 pr-4 text-left pl-4 bg-white`}
      >
        <div className="w-48 whitespace-normal sm:w-64" style={{ paddingLeft: Math.min(depth, 6) * 16 }}>
          {row.children.length ? (
            <button type="button" aria-expanded={expanded} onClick={onToggle} className="flex min-h-11 items-center gap-2 rounded-md text-left hover:bg-[var(--peace-sky-100)] focus-visible:outline-2 focus-visible:outline-offset-2">
              {expanded ? <ChevronDown size={18} aria-hidden="true" /> : <ChevronRight size={18} aria-hidden="true" />}
              <span>{row.label}<span className="block text-xs font-normal text-[var(--peace-muted)]">{row.type}</span></span>
            </button>
          ) : (
            <span className="block py-2 pl-[26px]">{row.label}{row.type ? <span className="block text-xs font-normal text-[var(--peace-muted)]">{row.type}</span> : null}</span>
          )}
        </div>
      </th>
      <td className="px-3 py-3 text-center">
        <CountLink
          count={row.people.length}
          href={participantHref(row.filter)}
          label={`Apri ${row.people.length} persone di ${row.label}`}
        />
      </td>
      {attendanceSlots.map((slot) => {
        const count = countPeopleForSlot(row.people, slot.key);

        return (
          <td key={slot.key} className="px-3 py-3 text-center">
            <CountLink
              count={count}
              href={participantHref({
                ...row.filter,
                attendanceSlot: slot.key,
              })}
              label={`Apri ${count} persone di ${row.label}, ${attendanceSlotLabel(slot)}`}
            />
          </td>
        );
      })}
    </tr>
  );
}

function AttendanceStatisticsSummary({
  statistics,
  participantHref,
}: {
  statistics: EventStatisticsSnapshot;
  participantHref: (filter: StatisticsDrilldownFilter) => string;
}) {
  const days = groupAttendanceSlotsByDay(statistics.attendanceSlots);

  return (
    <article className="min-w-0 max-w-full rounded-lg border border-[var(--peace-border)] bg-white p-5">
      <h3 className="text-base font-semibold">Riepilogo presenze previste</h3>
      <p className="mt-1 text-sm leading-6 text-[var(--peace-muted)]">
        Mattina e pomeriggio sono raggruppati per data. Seleziona un conteggio
        per vedere le iscrizioni corrispondenti.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {days.map(({ day, slots }) => (
          <section
            key={day}
            className="rounded-lg border border-[var(--peace-border)] bg-[#f7fbfe] p-4"
          >
            <h4 className="font-semibold text-[var(--peace-blue-900)]">
              {formatLongDay(day)}
            </h4>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {slots.map((slot) => (
                <AttendanceCountLink
                  key={slot.key}
                  label={attendancePartLabel(slot.dayPart)}
                  count={statistics.summary.attendanceSlotCounts[slot.key] ?? 0}
                  href={participantHref({ attendanceSlot: slot.key })}
                />
              ))}
            </div>
          </section>
        ))}

        <section className="rounded-lg border border-[var(--peace-border)] bg-[#f7fbfe] p-4">
          <h4 className="font-semibold text-[var(--peace-blue-900)]">
            Presenza non specificata
          </h4>
          <div className="mt-3">
            <AttendanceCountLink
              label="Nessuna fascia indicata"
              count={statistics.summary.withoutAttendance}
              href={participantHref({ attendanceSlot: "none" })}
            />
          </div>
        </section>
      </div>

      {days.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--peace-muted)]">
          Nessuna fascia di presenza configurata per l’evento.
        </p>
      ) : null}
    </article>
  );
}

function AgeStatisticsSummary({
  statistics,
  participantHref,
}: {
  statistics: EventStatisticsSnapshot;
  participantHref: (filter: StatisticsDrilldownFilter) => string;
}) {
  return (
    <article className="min-w-0 max-w-full rounded-lg border border-[var(--peace-border)] bg-white p-5">
      <h3 className="text-base font-semibold">Riepilogo fasce di età</h3>
      <p className="mt-1 text-sm leading-6 text-[var(--peace-muted)]">
        Distribuzione calcolata all’inizio dell’evento. I confini non si
        sovrappongono: 30 anni rientra in 15–30 e 65 anni in 65+.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {AGE_BANDS.map((ageBand) => (
          <SummaryFilterLink
            key={ageBand}
            label={ageBandLabel(ageBand)}
            count={statistics.summary.ageBandCounts[ageBand]}
            href={participantHref({ ageBand })}
          />
        ))}
      </div>
    </article>
  );
}

function SummaryKpi({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      aria-label={`Apri ${value} ${label.toLocaleLowerCase("it")}`}
      className="group flex items-center gap-3 rounded-lg border border-[var(--peace-border)] bg-[#f7fbfe] p-4 transition hover:border-[var(--peace-border-strong)] hover:bg-white hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--peace-blue-800)]"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-[var(--peace-blue-800)] shadow-sm">
        <Icon aria-hidden="true" size={20} />
      </span>
      <span>
        <span className="block text-2xl font-semibold text-[var(--peace-blue-800)] underline decoration-transparent underline-offset-4 transition group-hover:decoration-current">
          {value}
        </span>
        <span className="block text-sm text-[var(--peace-muted)]">{label}</span>
      </span>
    </Link>
  );
}

function SummaryFilterLink({
  label,
  count,
  href,
}: {
  label: string;
  count: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      aria-label={`Apri ${count} persone: ${label}`}
      className="group flex min-h-11 w-full items-center justify-between gap-3 rounded-md border border-[var(--peace-border)] bg-white px-3 py-2 text-left text-sm text-[var(--peace-ink)] transition hover:border-[var(--peace-border-strong)] hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--peace-blue-800)]"
    >
      <span className="min-w-0 truncate font-medium" title={label}>
        {label}
      </span>
      <span className="shrink-0 text-base font-semibold tabular-nums text-[var(--peace-blue-800)] underline decoration-transparent underline-offset-4 transition group-hover:decoration-current">
        {count}
      </span>
    </Link>
  );
}

function AttendanceCountLink({
  label,
  count,
  href,
}: {
  label: string;
  count: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      aria-label={`Apri ${count} persone: ${label}`}
      className="group grid min-h-20 place-items-center rounded-md border border-[var(--peace-border)] bg-white px-3 py-2 text-center transition hover:border-[var(--peace-border-strong)] hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--peace-blue-800)]"
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-[#6f7f91]">
        {label}
      </span>
      <span className="text-2xl font-semibold tabular-nums text-[var(--peace-blue-800)] underline decoration-transparent underline-offset-4 transition group-hover:decoration-current">
        {count}
      </span>
    </Link>
  );
}

function CountLink({
  count,
  href,
  label,
}: {
  count: number;
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-md px-2 font-semibold tabular-nums text-[var(--peace-blue-800)] underline decoration-[#9fc5dc] underline-offset-4 transition hover:bg-[var(--peace-sky-100)] hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--peace-blue-800)]"
    >
      {count}
    </Link>
  );
}

function buildParticipantsHref(
  dashboard: StatisticsDashboard,
  navMode: StatisticsNavMode,
  filter: StatisticsDrilldownFilter
): string {
  const params = new URLSearchParams({
    section: "iscritti",
    nav: navMode,
    stat: serializeStatisticsDrilldown(filter),
  });

  return `/dashboard/${dashboard}?${params.toString()}`;
}

function countPeopleForSlot(
  people: StatisticsPersonRow[],
  slotKey: string
): number {
  return people.filter((person) => person.attendanceSlotKeys.includes(slotKey))
    .length;
}

function groupAttendanceSlotsByDay(
  slots: StatisticsAttendanceSlot[]
): Array<{ day: string; slots: StatisticsAttendanceSlot[] }> {
  const slotsByDay = new Map<string, StatisticsAttendanceSlot[]>();

  for (const slot of slots) {
    const current = slotsByDay.get(slot.day) ?? [];
    current.push(slot);
    slotsByDay.set(slot.day, current);
  }

  return [...slotsByDay.entries()].map(([day, daySlots]) => ({
    day,
    slots: daySlots.sort(
      (first, second) =>
        attendancePartOrder(first.dayPart) - attendancePartOrder(second.dayPart)
    ),
  }));
}

function ageBandLabel(ageBand: StatisticsAgeBand): string {
  return ageBand === "unknown" ? "Età non indicata" : ageBand;
}

function attendanceSlotLabel(slot: StatisticsAttendanceSlot): string {
  return `${attendancePartLabel(slot.dayPart)} ${formatLongDay(slot.day)}`;
}

function attendancePartLabel(
  dayPart: StatisticsAttendanceSlot["dayPart"]
): string {
  return dayPart === "morning" ? "Mattina" : "Pomeriggio";
}

function attendancePartOrder(
  dayPart: StatisticsAttendanceSlot["dayPart"]
): number {
  return dayPart === "morning" ? 0 : 1;
}

function formatShortDate(value: string): string {
  return formatDate(value, { day: "numeric", month: "short" });
}

function formatLongDay(value: string): string {
  return formatDate(value, { weekday: "long", day: "numeric", month: "long" });
}

function formatDate(value: string, options: Intl.DateTimeFormatOptions): string {
  const date = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("it-IT", {
    ...options,
    timeZone: "UTC",
  }).format(date);
}

function WeeklyRegistrations({ statistics }: { statistics: EventStatisticsSnapshot }) {
  const { weeks, undated } = statistics.registrationTimeline;
  const maximum = Math.max(1, ...weeks.map((week) => week.count));
  const completed = weeks.filter((week) => !week.current && !week.historical);
  const latest = completed.at(-1);
  const previous = completed.at(-2);
  const delta = latest && previous ? latest.count - previous.count : null;
  const label = (date: string) => formatDate(date, { day: "2-digit", month: "2-digit" });

  return (
    <article className="min-w-0 rounded-lg border border-[var(--peace-border)] bg-white p-5">
      <p className="text-sm leading-6 text-[var(--peace-muted)]">
        Nuove iscrizioni per settimana, da lunedì a domenica (ora italiana).
        Ogni scheda vale un’iscrizione; minori accompagnati esclusi. Sono conteggiate le iscrizioni non eliminate.
        Le iscrizioni precedenti al 31/08/2026 sono riunite nella prima colonna.
        La settimana in corso è incompleta; questa e la colonna storica sono escluse dal confronto.
      </p>
      {delta !== null && latest && previous ? (
        <p className="mt-3 text-sm font-semibold text-[var(--peace-blue-900)]">
          Ultima settimana conclusa ({label(latest.start)} – {label(latest.end)}): {latest.count} iscrizioni.
          {" "}{delta > 0 ? "In aumento" : delta < 0 ? "In diminuzione" : "Stabili"} rispetto alla precedente
          {delta !== 0 ? `: ${delta > 0 ? "+" : ""}${delta}${previous.count > 0 ? ` (${delta > 0 ? "+" : ""}${new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 }).format(delta / previous.count * 100)}%)` : ""}` : ""}.
        </p>
      ) : <p className="mt-3 text-sm text-[var(--peace-muted)]">Il confronto sarà disponibile dopo due settimane concluse.</p>}
      {weeks.length ? (
        <div className="mt-6 overflow-x-auto overscroll-x-contain" tabIndex={0} role="region" aria-label="Grafico iscrizioni settimanali, scorrimento orizzontale">
          <div className="flex w-max gap-px pb-3 pr-3">
            {weeks.map((week) => (
              <div key={week.start} className="w-14 shrink-0 text-center" aria-label={`${week.historical ? "Prima del 31/08" : `${label(week.start)} – ${label(week.end)}`}: ${week.count} iscrizioni${week.current ? ", settimana in corso incompleta" : ""}`}>
                <div className="flex h-56 flex-col justify-end border-b border-[var(--peace-border)]" aria-hidden="true">
                  <span className="mb-1 text-sm font-semibold tabular-nums">{week.count}</span>
                  <div className={`w-full rounded-t-sm ${week.current ? "border-2 border-dashed border-[var(--peace-blue-800)] bg-[#cce3f2]" : week.historical ? "bg-slate-400" : "bg-[var(--peace-blue-800)]"}`} style={{ height: `${week.count / maximum * 180}px` }} />
                </div>
                <div className="relative h-24"><p className="absolute left-7 top-2 origin-top-left rotate-45 whitespace-nowrap text-[10px]">{week.historical ? "Prima del 31/08" : `${label(week.start)} – ${label(week.end)}`}{week.current ? " · In corso" : ""}</p></div>
              </div>
            ))}
          </div>
        </div>
      ) : <p className="mt-5 text-sm">Nessuna iscrizione con data disponibile.</p>}
      {undated > 0 ? <p className="mt-3 text-sm text-[var(--peace-muted)]">Iscrizioni senza data valida, escluse dal grafico: {undated}.</p> : null}
    </article>
  );
}
