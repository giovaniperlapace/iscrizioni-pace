"use client";

import {
  Baby,
  Check,
  Search,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

import type {
  EventStatisticsSnapshot,
  ParticipantBreakdownLevel,
  StatisticsAgeBand,
  StatisticsAttendanceSlot,
  StatisticsPersonRow,
} from "@/lib/registrations/event-statistics";

type StatisticsSectionProps = {
  statistics: EventStatisticsSnapshot;
};

type SummaryBreakdownRow = {
  label: string;
  count: number;
};

const ALL_FILTER = "all";
const NO_ATTENDANCE_FILTER = "none";
const AGE_BANDS: StatisticsAgeBand[] = [
  "0-14",
  "15-30",
  "30-65",
  "65+",
  "unknown",
];

export function StatisticsSection({ statistics }: StatisticsSectionProps) {
  const [territorySearch, setTerritorySearch] = useState("");
  const [countryFilter, setCountryFilter] = useState(ALL_FILTER);
  const [cityFilter, setCityFilter] = useState(ALL_FILTER);
  const [groupFilter, setGroupFilter] = useState(ALL_FILTER);
  const [attendanceSearch, setAttendanceSearch] = useState("");
  const [attendanceFilter, setAttendanceFilter] = useState(ALL_FILTER);
  const [ageSearch, setAgeSearch] = useState("");
  const [ageBandFilter, setAgeBandFilter] = useState(ALL_FILTER);

  const countries = useMemo(
    () => uniqueSorted(statistics.people.map((person) => person.country)),
    [statistics.people]
  );
  const cities = useMemo(
    () => uniqueSorted(statistics.people.map((person) => person.city)),
    [statistics.people]
  );
  const groups = useMemo(
    () => uniqueSorted(statistics.people.map((person) => person.group)),
    [statistics.people]
  );
  const territorySummary = useMemo(
    () => ({
      country: summarizeLabels(statistics.people.map((person) => person.country)),
      city: summarizeLabels(statistics.people.map((person) => person.city)),
      group: summarizeLabels(statistics.people.map((person) => person.group)),
    }),
    [statistics.people]
  );

  const territoryRows = useMemo(() => {
    const query = normalizeSearchValue(territorySearch);

    return statistics.people
      .filter(
        (person) =>
          matchesPersonSearch(person, query, [
            person.country,
            person.city,
            person.group,
          ]) &&
          (countryFilter === ALL_FILTER || person.country === countryFilter) &&
          (cityFilter === ALL_FILTER || person.city === cityFilter) &&
          (groupFilter === ALL_FILTER || person.group === groupFilter)
      )
      .sort(
        (first, second) =>
          first.country.localeCompare(second.country, "it", { sensitivity: "base" }) ||
          first.city.localeCompare(second.city, "it", { sensitivity: "base" }) ||
          first.group.localeCompare(second.group, "it", { sensitivity: "base" }) ||
          first.name.localeCompare(second.name, "it", { sensitivity: "base" })
      );
  }, [
    statistics.people,
    territorySearch,
    countryFilter,
    cityFilter,
    groupFilter,
  ]);

  const attendanceRows = useMemo(() => {
    const query = normalizeSearchValue(attendanceSearch);

    return statistics.people.filter((person) => {
      if (!matchesPersonSearch(person, query, [person.group])) {
        return false;
      }

      if (attendanceFilter === ALL_FILTER) {
        return true;
      }

      if (attendanceFilter === NO_ATTENDANCE_FILTER) {
        return person.attendanceSlotKeys.length === 0;
      }

      return person.attendanceSlotKeys.includes(attendanceFilter);
    });
  }, [statistics.people, attendanceSearch, attendanceFilter]);

  const ageRows = useMemo(() => {
    const query = normalizeSearchValue(ageSearch);

    return statistics.people
      .filter(
        (person) =>
          matchesPersonSearch(person, query, [
            person.birthDate ?? "",
            person.age === null ? "" : String(person.age),
            ageBandLabel(person.ageBand),
          ]) &&
          (ageBandFilter === ALL_FILTER || person.ageBand === ageBandFilter)
      )
      .sort(
        (first, second) =>
          compareNullableAge(first.age, second.age) ||
          first.name.localeCompare(second.name, "it", { sensitivity: "base" })
      );
  }, [statistics.people, ageSearch, ageBandFilter]);

  function showTerritoryPeople(
    level: ParticipantBreakdownLevel,
    label: string
  ) {
    setTerritorySearch("");
    setCountryFilter(level === "country" ? label : ALL_FILTER);
    setCityFilter(level === "city" ? label : ALL_FILTER);
    setGroupFilter(level === "group" ? label : ALL_FILTER);
    scrollToDetailedTable("statistics-territory-table");
  }

  function showAttendancePeople(slotKey: string) {
    setAttendanceSearch("");
    setAttendanceFilter(slotKey);
    scrollToDetailedTable("statistics-attendance-table");
  }

  function showAgeBandPeople(ageBand: StatisticsAgeBand) {
    setAgeSearch("");
    setAgeBandFilter(ageBand);
    scrollToDetailedTable("statistics-age-table");
  }

  return (
    <section className="grid min-w-0 gap-8">
      <div className="surface-panel p-5">
        <h2 className="text-lg font-semibold">Statistiche evento</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--peace-muted)]">
          Tabelle di consultazione in sola lettura. Cerca una persona o filtra i
          dati per leggere subito chi compone ogni insieme.
        </p>
      </div>

      <ReportBlock name="territory" title="Territori e gruppi">
        <TerritoryStatisticsSummary
          statistics={statistics}
          territorySummary={territorySummary}
          countryFilter={countryFilter}
          cityFilter={cityFilter}
          groupFilter={groupFilter}
          onTerritorySelect={showTerritoryPeople}
        />

        <article
          id="statistics-territory-table"
          className="scroll-mt-5 rounded-lg border border-[var(--peace-border)] bg-white p-5"
        >
        <div>
          <h3 className="text-base font-semibold">Persone per territorio e gruppo</h3>
          <p className="mt-1 text-sm leading-6 text-[var(--peace-muted)]">
            Una riga per ogni persona iscritta, compresi i minori accompagnati.
          </p>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(15rem,1.4fr)_repeat(3,minmax(10rem,1fr))]">
          <SearchField
            label="Cerca nella tabella territorio"
            value={territorySearch}
            onChange={setTerritorySearch}
            placeholder="Cerca persona, paese, città o gruppo"
          />
          <FilterSelect
            label="Paese"
            value={countryFilter}
            onChange={setCountryFilter}
            options={countries}
          />
          <FilterSelect
            label="Città"
            value={cityFilter}
            onChange={setCityFilter}
            options={cities}
          />
          <FilterSelect
            label="Gruppo"
            value={groupFilter}
            onChange={setGroupFilter}
            options={groups}
          />
        </div>

        <ResultCount count={territoryRows.length} total={statistics.people.length} />

        <div className="mt-3 max-h-[34rem] overflow-auto rounded-md border border-[var(--peace-border)]">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-[#f7fbfe]">
              <tr className="border-b border-[var(--peace-border)] text-xs uppercase tracking-wide text-[#6f7f91]">
                <th className="px-4 py-3 font-semibold">Persona</th>
                <th className="px-4 py-3 font-semibold">Paese</th>
                <th className="px-4 py-3 font-semibold">Città</th>
                <th className="px-4 py-3 font-semibold">Gruppo</th>
              </tr>
            </thead>
            <tbody>
              {territoryRows.map((person) => (
                <tr
                  key={person.id}
                  className="border-b border-[var(--peace-border)] last:border-b-0"
                >
                  <td className="px-4 py-3">
                    <PersonName person={person} />
                  </td>
                  <td className="px-4 py-3">{person.country}</td>
                  <td className="px-4 py-3">{person.city}</td>
                  <td className="px-4 py-3 font-medium">{person.group}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

          {territoryRows.length === 0 ? <EmptyTableMessage /> : null}
        </article>
      </ReportBlock>

      <ReportBlock name="attendance" title="Presenze previste">
        <AttendanceStatisticsSummary
          statistics={statistics}
          attendanceFilter={attendanceFilter}
          onAttendanceSelect={showAttendancePeople}
        />

        <article
          id="statistics-attendance-table"
          className="scroll-mt-5 rounded-lg border border-[var(--peace-border)] bg-white p-5"
        >
        <div>
          <h3 className="text-base font-semibold">Presenze per giorno e fascia</h3>
          <p className="mt-1 text-sm leading-6 text-[var(--peace-muted)]">
            Vista incrociata delle persone con le fasce mattina e pomeriggio
            indicate nell’iscrizione.
          </p>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(15rem,1fr)_minmax(14rem,0.8fr)]">
          <SearchField
            label="Cerca nella tabella presenze"
            value={attendanceSearch}
            onChange={setAttendanceSearch}
            placeholder="Cerca persona o gruppo"
          />
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[#6f7f91]">
            Presenza
            <select
              value={attendanceFilter}
              onChange={(event) => setAttendanceFilter(event.target.value)}
              className="min-h-11 w-full rounded-md border border-[var(--peace-border)] bg-white px-3 text-sm font-normal normal-case tracking-normal text-[var(--peace-ink)]"
            >
              <option value={ALL_FILTER}>Tutte le persone</option>
              {statistics.attendanceSlots.map((slot) => (
                <option key={slot.key} value={slot.key}>
                  {attendanceSlotLabel(slot)}
                </option>
              ))}
              <option value={NO_ATTENDANCE_FILTER}>Nessuna fascia indicata</option>
            </select>
          </label>
        </div>

        <ResultCount count={attendanceRows.length} total={statistics.people.length} />

        <div className="mt-3 max-h-[34rem] overflow-auto rounded-md border border-[var(--peace-border)]">
          <table className="w-full min-w-max border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-[#f7fbfe]">
              <tr className="border-b border-[var(--peace-border)] text-xs uppercase tracking-wide text-[#6f7f91]">
                <th className="sticky left-0 z-20 min-w-60 bg-[#f7fbfe] px-4 py-3 font-semibold">
                  Persona
                </th>
                {statistics.attendanceSlots.map((slot) => (
                  <th
                    key={slot.key}
                    className="min-w-28 px-3 py-3 text-center font-semibold"
                  >
                    <span className="block">{formatShortDate(slot.day)}</span>
                    <span className="mt-0.5 block normal-case tracking-normal">
                      {attendancePartLabel(slot.dayPart)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {attendanceRows.map((person) => (
                <tr
                  key={person.id}
                  className="border-b border-[var(--peace-border)] last:border-b-0"
                >
                  <td className="sticky left-0 bg-white px-4 py-3">
                    <PersonName person={person} />
                    {person.attendanceSlotKeys.length === 0 ? (
                      <span className="mt-1 block text-xs text-[var(--peace-muted)]">
                        {person.attendanceUnknown
                          ? "Presenza da indicare"
                          : "Nessuna fascia indicata"}
                      </span>
                    ) : null}
                  </td>
                  {statistics.attendanceSlots.map((slot) => {
                    const isPresent = person.attendanceSlotKeys.includes(slot.key);

                    return (
                      <td key={slot.key} className="px-3 py-3 text-center">
                        {isPresent ? (
                          <span
                            className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[#e7f5ed] px-2 text-[#167548]"
                            aria-label={`Presente: ${attendanceSlotLabel(slot)}`}
                            title="Presente"
                          >
                            <Check aria-hidden="true" size={16} strokeWidth={2.5} />
                          </span>
                        ) : (
                          <span className="text-[#a1afbd]" aria-label="Non indicata">
                            —
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

          {statistics.attendanceSlots.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--peace-muted)]">
              Nessuna fascia di presenza configurata per l’evento.
            </p>
          ) : attendanceRows.length === 0 ? (
            <EmptyTableMessage />
          ) : null}
        </article>
      </ReportBlock>

      <ReportBlock name="age" title="Fasce di età">
        <AgeStatisticsSummary
          statistics={statistics}
          ageBandFilter={ageBandFilter}
          onAgeBandSelect={showAgeBandPeople}
        />

        <article
          id="statistics-age-table"
          className="scroll-mt-5 rounded-lg border border-[var(--peace-border)] bg-white p-5"
        >
        <div>
          <h3 className="text-base font-semibold">Persone per età</h3>
          <p className="mt-1 text-sm leading-6 text-[var(--peace-muted)]">
            L’età è calcolata alla data iniziale dell’evento. Le fasce non
            duplicano i confini: 30 anni rientra in 15–30 e 65 anni in 65+.
          </p>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(15rem,1fr)_minmax(12rem,0.55fr)]">
          <SearchField
            label="Cerca nella tabella età"
            value={ageSearch}
            onChange={setAgeSearch}
            placeholder="Cerca persona, età o fascia"
          />
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[#6f7f91]">
            Fascia di età
            <select
              value={ageBandFilter}
              onChange={(event) => setAgeBandFilter(event.target.value)}
              className="min-h-11 w-full rounded-md border border-[var(--peace-border)] bg-white px-3 text-sm font-normal normal-case tracking-normal text-[var(--peace-ink)]"
            >
              <option value={ALL_FILTER}>Tutte le fasce</option>
              {AGE_BANDS.map((band) => (
                <option key={band} value={band}>
                  {ageBandLabel(band)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <ResultCount count={ageRows.length} total={statistics.people.length} />

        <div className="mt-3 max-h-[34rem] overflow-auto rounded-md border border-[var(--peace-border)]">
          <table className="w-full min-w-[680px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-[#f7fbfe]">
              <tr className="border-b border-[var(--peace-border)] text-xs uppercase tracking-wide text-[#6f7f91]">
                <th className="px-4 py-3 font-semibold">Persona</th>
                <th className="px-4 py-3 font-semibold">Data di nascita</th>
                <th className="px-4 py-3 text-right font-semibold">Età</th>
                <th className="px-4 py-3 font-semibold">Fascia</th>
              </tr>
            </thead>
            <tbody>
              {ageRows.map((person) => (
                <tr
                  key={person.id}
                  className="border-b border-[var(--peace-border)] last:border-b-0"
                >
                  <td className="px-4 py-3">
                    <PersonName person={person} />
                  </td>
                  <td className="px-4 py-3">
                    {person.birthDate ? formatLongDate(person.birthDate) : "Non indicata"}
                  </td>
                  <td className="px-4 py-3 text-right text-base font-semibold">
                    {person.age ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {ageBandLabel(person.ageBand)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

          {ageRows.length === 0 ? <EmptyTableMessage /> : null}
        </article>
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
      className="relative grid min-w-0 gap-4 overflow-hidden rounded-2xl border-2 border-[#bfd8ea] bg-[#eef7fc] p-3 shadow-[0_14px_34px_rgba(23,72,112,0.10)] sm:p-5"
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
  countryFilter,
  cityFilter,
  groupFilter,
  onTerritorySelect,
}: {
  statistics: EventStatisticsSnapshot;
  territorySummary: Record<ParticipantBreakdownLevel, SummaryBreakdownRow[]>;
  countryFilter: string;
  cityFilter: string;
  groupFilter: string;
  onTerritorySelect: (
    level: ParticipantBreakdownLevel,
    label: string
  ) => void;
}) {
  return (
    <article className="rounded-lg border border-[var(--peace-border)] bg-white p-5">
      <div>
        <h3 className="text-base font-semibold">
          Riepilogo persone, territori e gruppi
        </h3>
        <p className="mt-1 text-sm leading-6 text-[var(--peace-muted)]">
          Seleziona un territorio o un gruppo per vedere subito nella tabella
          successiva le persone che compongono il totale.
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <SummaryKpi
          icon={Users}
          label="Persone complessive"
          value={statistics.summary.totalPeople}
        />
        <SummaryKpi
          icon={UserRound}
          label="Partecipanti iscritti"
          value={statistics.summary.registeredParticipants}
        />
        <SummaryKpi
          icon={Baby}
          label="Minori accompagnati"
          value={statistics.summary.accompanyingChildren}
        />
      </div>

      <div className="mt-4">
        <SummaryPanel
          title="Territori e gruppi più rappresentati"
          description="Le prime cinque voci per numero di persone; tutte le altre restano disponibili nei filtri della tabella."
        >
          <div className="grid gap-4 lg:grid-cols-3">
            {(
              [
                ["country", "Paesi", countryFilter],
                ["city", "Città", cityFilter],
                ["group", "Gruppi", groupFilter],
              ] as const
            ).map(([level, title, activeFilter]) => (
              <div key={level}>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6f7f91]">
                  {title}
                </h4>
                <div className="grid gap-2">
                  {territorySummary[level].slice(0, 5).map((row) => (
                    <SummaryFilterButton
                      key={row.label}
                      label={row.label}
                      count={row.count}
                      active={activeFilter === row.label}
                      onClick={() => onTerritorySelect(level, row.label)}
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

function AttendanceStatisticsSummary({
  statistics,
  attendanceFilter,
  onAttendanceSelect,
}: {
  statistics: EventStatisticsSnapshot;
  attendanceFilter: string;
  onAttendanceSelect: (slotKey: string) => void;
}) {
  return (
    <article className="@container min-w-0 rounded-lg border border-[var(--peace-border)] bg-white p-5">
      <h3 className="text-base font-semibold">Riepilogo presenze previste</h3>
      <p className="mt-1 text-sm leading-6 text-[var(--peace-muted)]">
        Seleziona un giorno e una fascia per vedere le persone corrispondenti
        nella tabella successiva.
      </p>
      <div className="mt-4 grid min-w-0 gap-2 @[32rem]:grid-cols-2 @[48rem]:grid-cols-3 @[64rem]:grid-cols-4">
        {statistics.attendanceSlots.map((slot) => (
          <SummaryFilterButton
            key={slot.key}
            label={attendanceSlotLabel(slot)}
            count={statistics.summary.attendanceSlotCounts[slot.key] ?? 0}
            active={attendanceFilter === slot.key}
            onClick={() => onAttendanceSelect(slot.key)}
          />
        ))}
        <SummaryFilterButton
          label="Nessuna fascia indicata"
          count={statistics.summary.withoutAttendance}
          active={attendanceFilter === NO_ATTENDANCE_FILTER}
          onClick={() => onAttendanceSelect(NO_ATTENDANCE_FILTER)}
        />
      </div>
    </article>
  );
}

function AgeStatisticsSummary({
  statistics,
  ageBandFilter,
  onAgeBandSelect,
}: {
  statistics: EventStatisticsSnapshot;
  ageBandFilter: string;
  onAgeBandSelect: (ageBand: StatisticsAgeBand) => void;
}) {
  return (
    <article className="rounded-lg border border-[var(--peace-border)] bg-white p-5">
      <h3 className="text-base font-semibold">Riepilogo fasce di età</h3>
      <p className="mt-1 text-sm leading-6 text-[var(--peace-muted)]">
        Distribuzione calcolata all’inizio dell’evento. Seleziona una fascia
        per vedere le persone corrispondenti nella tabella successiva.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {AGE_BANDS.map((ageBand) => (
          <SummaryFilterButton
            key={ageBand}
            label={ageBandLabel(ageBand)}
            count={statistics.summary.ageBandCounts[ageBand]}
            active={ageBandFilter === ageBand}
            onClick={() => onAgeBandSelect(ageBand)}
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
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--peace-border)] bg-[#f7fbfe] p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-[var(--peace-blue-800)] shadow-sm">
        <Icon aria-hidden="true" size={20} />
      </span>
      <span>
        <span className="block text-2xl font-semibold text-[var(--peace-ink)]">
          {value}
        </span>
        <span className="block text-sm text-[var(--peace-muted)]">{label}</span>
      </span>
    </div>
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

function SummaryFilterButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--peace-blue-800)] ${
        active
          ? "border-[var(--peace-blue-800)] bg-white text-[var(--peace-blue-900)] shadow-sm"
          : "border-[var(--peace-border)] bg-white text-[var(--peace-ink)] hover:border-[var(--peace-border-strong)]"
      }`}
    >
      <span className="min-w-0 truncate font-medium" title={label}>
        {label}
      </span>
      <span className="shrink-0 text-base font-semibold tabular-nums">{count}</span>
    </button>
  );
}

function scrollToDetailedTable(id: string) {
  window.requestAnimationFrame(() => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
}

function SearchField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[#6f7f91]">
      Cerca
      <span className="relative block">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6f7f91]"
          size={17}
        />
        <input
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label={label}
          className="min-h-11 w-full rounded-md border border-[var(--peace-border)] bg-white py-2 pl-10 pr-3 text-sm font-normal normal-case tracking-normal text-[var(--peace-ink)] placeholder:text-[#8291a2]"
        />
      </span>
    </label>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[#6f7f91]">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded-md border border-[var(--peace-border)] bg-white px-3 text-sm font-normal normal-case tracking-normal text-[var(--peace-ink)]"
      >
        <option value={ALL_FILTER}>Tutti</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function PersonName({ person }: { person: StatisticsPersonRow }) {
  return (
    <span className="block">
      <span className="block font-semibold text-[var(--peace-ink)]">{person.name}</span>
      <span className="mt-0.5 block text-xs text-[var(--peace-muted)]">
        {person.kind === "child" ? "Minore accompagnato" : "Partecipante"}
      </span>
    </span>
  );
}

function ResultCount({ count, total }: { count: number; total: number }) {
  return (
    <p className="mt-4 text-sm text-[var(--peace-muted)]" aria-live="polite">
      {count === total
        ? `${count} ${count === 1 ? "persona" : "persone"}`
        : `${count} di ${total} persone`}
    </p>
  );
}

function EmptyTableMessage() {
  return (
    <p className="mt-4 text-sm text-[var(--peace-muted)]">
      Nessuna persona corrisponde ai filtri impostati.
    </p>
  );
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((first, second) =>
    first.localeCompare(second, "it", { sensitivity: "base" })
  );
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

function matchesPersonSearch(
  person: StatisticsPersonRow,
  normalizedQuery: string,
  extraValues: string[]
): boolean {
  if (!normalizedQuery) {
    return true;
  }

  return [person.name, ...extraValues].some((value) =>
    normalizeSearchValue(value).includes(normalizedQuery)
  );
}

function normalizeSearchValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("it")
    .trim();
}

function compareNullableAge(first: number | null, second: number | null): number {
  if (first === null) {
    return second === null ? 0 : 1;
  }

  if (second === null) {
    return -1;
  }

  return first - second;
}

function ageBandLabel(ageBand: StatisticsAgeBand): string {
  return ageBand === "unknown" ? "Età non indicata" : ageBand;
}

function attendanceSlotLabel(slot: StatisticsAttendanceSlot): string {
  return `${formatShortDate(slot.day)} · ${attendancePartLabel(slot.dayPart)}`;
}

function attendancePartLabel(
  dayPart: StatisticsAttendanceSlot["dayPart"]
): string {
  switch (dayPart) {
    case "morning":
      return "Mattina";
    case "afternoon":
      return "Pomeriggio";
    case "day":
      return "Giornata";
  }
}

function formatShortDate(value: string): string {
  return formatDate(value, { day: "numeric", month: "short" });
}

function formatLongDate(value: string): string {
  return formatDate(value, { day: "2-digit", month: "2-digit", year: "numeric" });
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
