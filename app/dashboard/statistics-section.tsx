"use client";

import Link from "next/link";
import {
  Baby,
  ChevronDown,
  ChevronRight,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Fragment, type ReactNode, useMemo, useState } from "react";

import {
  serializeStatisticsDrilldown,
  type EventStatisticsSnapshot,
  type ParticipantBreakdownLevel,
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

type SummaryBreakdownRow = {
  label: string;
  count: number;
};

type PivotLevel = "country" | "city" | "group";

type TerritoryPivotRow = {
  key: string;
  level: PivotLevel;
  label: string;
  people: StatisticsPersonRow[];
  filter: StatisticsDrilldownFilter;
  children: TerritoryPivotRow[];
};

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
  const territorySummary = useMemo(
    () => ({
      country: summarizeLabels(statistics.people.map((person) => person.country)),
      city: summarizeLabels(statistics.people.map((person) => person.city)),
      group: summarizeLabels(statistics.people.map((person) => person.group)),
    }),
    [statistics.people]
  );
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

      <ReportBlock name="territory" title="Territori e gruppi">
        <TerritoryStatisticsSummary
          statistics={statistics}
          territorySummary={territorySummary}
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
    </section>
  );
}

function ReportBlock({
  name,
  title,
  children,
}: {
  name: "territory" | "attendance" | "age";
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
  territorySummary,
  participantHref,
}: {
  statistics: EventStatisticsSnapshot;
  territorySummary: Record<ParticipantBreakdownLevel, SummaryBreakdownRow[]>;
  participantHref: (filter: StatisticsDrilldownFilter) => string;
}) {
  return (
    <article className="min-w-0 max-w-full rounded-lg border border-[var(--peace-border)] bg-white p-5">
      <div>
        <h3 className="text-base font-semibold">
          Riepilogo persone, territori e gruppi
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

      <div className="mt-4">
        <SummaryPanel
          title="Territori e gruppi più rappresentati"
          description="Le prime cinque voci per numero di persone; il riepilogo completo è nella tabella pivot successiva."
        >
          <div className="grid gap-4 lg:grid-cols-3">
            {(
              [
                ["country", "Paesi"],
                ["city", "Città"],
                ["group", "Gruppi"],
              ] as const
            ).map(([level, title]) => (
              <div key={level}>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6f7f91]">
                  {title}
                </h4>
                <div className="grid gap-2">
                  {territorySummary[level].slice(0, 5).map((row) => (
                    <SummaryFilterLink
                      key={row.label}
                      label={row.label}
                      count={row.count}
                      href={participantHref({ [level]: row.label })}
                    />
                  ))}
                  {territorySummary[level].length === 0 ? (
                    <p className="text-sm text-[var(--peace-muted)]">
                      Nessun dato disponibile.
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </SummaryPanel>
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
  const rows = useMemo(() => buildTerritoryPivotRows(people), [people]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(() => new Set());

  function toggleRow(key: string) {
    setExpandedRows((current) => {
      const next = new Set(current);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  }

  return (
    <article className="min-w-0 max-w-full rounded-lg border border-[var(--peace-border)] bg-white p-5">
      <div>
        <h3 className="text-base font-semibold">Persone per territorio e gruppo</h3>
        <p className="mt-1 text-sm leading-6 text-[var(--peace-muted)]">
          Espandi un paese per vedere le città. Le città con più gruppi possono
          essere aperte a loro volta. Le colonne mostrano le presenze previste
          per mattina e pomeriggio.
        </p>
      </div>

      <div className="mt-5 min-w-0 max-w-full overflow-x-auto overscroll-x-contain rounded-md border border-[var(--peace-border)]">
        <table className="w-full min-w-max border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-[#f7fbfe]">
            <tr className="border-b border-[var(--peace-border)] text-xs uppercase tracking-wide text-[#6f7f91]">
              <th className="sticky left-0 z-20 min-w-64 bg-[#f7fbfe] px-4 py-3 font-semibold">
                Territorio o gruppo
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
            {rows.map((country) => (
              <Fragment key={country.key}>
                <TerritoryPivotTableRow
                  row={country}
                  attendanceSlots={attendanceSlots}
                  expanded={expandedRows.has(country.key)}
                  onToggle={() => toggleRow(country.key)}
                  participantHref={participantHref}
                />
                {expandedRows.has(country.key)
                  ? country.children.map((city) => (
                      <Fragment key={city.key}>
                        <TerritoryPivotTableRow
                          row={city}
                          attendanceSlots={attendanceSlots}
                          expanded={expandedRows.has(city.key)}
                          onToggle={() => toggleRow(city.key)}
                          participantHref={participantHref}
                        />
                        {expandedRows.has(city.key)
                          ? city.children.map((group) => (
                              <TerritoryPivotTableRow
                                key={group.key}
                                row={group}
                                attendanceSlots={attendanceSlots}
                                expanded={false}
                                onToggle={() => undefined}
                                participantHref={participantHref}
                              />
                            ))
                          : null}
                      </Fragment>
                    ))
                  : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--peace-muted)]">
          Nessun dato territoriale disponibile.
        </p>
      ) : null}
    </article>
  );
}

function TerritoryPivotTableRow({
  row,
  attendanceSlots,
  expanded,
  onToggle,
  participantHref,
}: {
  row: TerritoryPivotRow;
  attendanceSlots: StatisticsAttendanceSlot[];
  expanded: boolean;
  onToggle: () => void;
  participantHref: (filter: StatisticsDrilldownFilter) => string;
}) {
  const canExpand = row.children.length > 0;
  const rowTone =
    row.level === "country"
      ? "bg-white font-semibold"
      : row.level === "city"
        ? "bg-[#fbfdff] font-medium"
        : "bg-[#f7fbfe]";
  const indent =
    row.level === "country" ? "pl-4" : row.level === "city" ? "pl-10" : "pl-16";

  return (
    <tr className={`border-b border-[var(--peace-border)] last:border-b-0 ${rowTone}`}>
      <th
        scope="row"
        className={`sticky left-0 z-[5] min-w-64 py-3 pr-4 text-left ${indent} ${rowTone}`}
      >
        {canExpand ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="-ml-1 flex min-h-8 items-center gap-2 rounded-md pr-2 text-left transition hover:bg-[var(--peace-sky-100)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--peace-blue-800)]"
          >
            <span className="grid size-8 shrink-0 place-items-center text-[var(--peace-blue-800)]">
              {expanded ? (
                <ChevronDown aria-hidden="true" size={18} />
              ) : (
                <ChevronRight aria-hidden="true" size={18} />
              )}
            </span>
            <span>{row.label}</span>
          </button>
        ) : (
          <span className="flex min-h-8 items-center gap-2">
            <span aria-hidden="true" className="size-8 shrink-0" />
            <span>{row.label}</span>
          </span>
        )}
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

function SummaryPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="h-full rounded-lg border border-[var(--peace-border)] bg-[#f7fbfe] p-4">
      <h4 className="font-semibold text-[var(--peace-ink)]">{title}</h4>
      <p className="mt-1 text-sm leading-5 text-[var(--peace-muted)]">
        {description}
      </p>
      <div className="mt-3">{children}</div>
    </section>
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

function buildTerritoryPivotRows(
  people: StatisticsPersonRow[]
): TerritoryPivotRow[] {
  const countries = groupPeopleByLabel(people, (person) => person.country);

  return sortedGroupEntries(countries).map(([country, countryPeople]) => {
    const cities = groupPeopleByLabel(countryPeople, (person) => person.city);
    const cityRows = sortedGroupEntries(cities).map(([city, cityPeople]) => {
      const groups = groupPeopleByLabel(cityPeople, (person) => person.group);
      const groupRows =
        groups.size > 1
          ? sortedGroupEntries(groups).map(([group, groupPeople]) => ({
              key: pivotRowKey("group", country, city, group),
              level: "group" as const,
              label: group,
              people: groupPeople,
              filter: { country, city, group },
              children: [],
            }))
          : [];

      return {
        key: pivotRowKey("city", country, city),
        level: "city" as const,
        label: city,
        people: cityPeople,
        filter: { country, city },
        children: groupRows,
      };
    });

    return {
      key: pivotRowKey("country", country),
      level: "country" as const,
      label: country,
      people: countryPeople,
      filter: { country },
      children: cityRows,
    };
  });
}

function groupPeopleByLabel(
  people: StatisticsPersonRow[],
  getLabel: (person: StatisticsPersonRow) => string
): Map<string, StatisticsPersonRow[]> {
  const grouped = new Map<string, StatisticsPersonRow[]>();

  for (const person of people) {
    const label = getLabel(person);
    const current = grouped.get(label) ?? [];
    current.push(person);
    grouped.set(label, current);
  }

  return grouped;
}

function sortedGroupEntries(
  grouped: Map<string, StatisticsPersonRow[]>
): Array<[string, StatisticsPersonRow[]]> {
  return [...grouped.entries()].sort(([first], [second]) =>
    first.localeCompare(second, "it", { sensitivity: "base" })
  );
}

function pivotRowKey(level: PivotLevel, ...labels: string[]): string {
  return `${level}:${labels.map((label) => encodeURIComponent(label)).join(":")}`;
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

function summarizeLabels(values: string[]): SummaryBreakdownRow[] {
  const countByLabel = new Map<string, number>();

  for (const label of values) {
    countByLabel.set(label, (countByLabel.get(label) ?? 0) + 1);
  }

  return [...countByLabel.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort(
      (first, second) =>
        second.count - first.count ||
        first.label.localeCompare(second.label, "it", { sensitivity: "base" })
    );
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
