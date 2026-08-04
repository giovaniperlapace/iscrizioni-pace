"use client";

import { Check, Search } from "lucide-react";
import { useMemo, useState } from "react";

import type {
  EventStatisticsSnapshot,
  StatisticsAgeBand,
  StatisticsAttendanceSlot,
  StatisticsPersonRow,
} from "@/lib/registrations/event-statistics";

type StatisticsSectionProps = {
  statistics: EventStatisticsSnapshot;
};

const ALL_FILTER = "all";
const NO_ATTENDANCE_FILTER = "none";

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

  return (
    <section className="grid min-w-0 gap-4">
      <div className="surface-panel p-5">
        <h2 className="text-lg font-semibold">Statistiche evento</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--peace-muted)]">
          Tabelle di consultazione in sola lettura. Cerca una persona o filtra i
          dati per leggere subito chi compone ogni insieme.
        </p>
      </div>

      <article className="rounded-lg border border-[var(--peace-border)] bg-white p-5">
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

      <article className="rounded-lg border border-[var(--peace-border)] bg-white p-5">
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

      <article className="rounded-lg border border-[var(--peace-border)] bg-white p-5">
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
              {(["0-14", "15-30", "30-65", "65+", "unknown"] as const).map(
                (band) => (
                  <option key={band} value={band}>
                    {ageBandLabel(band)}
                  </option>
                )
              )}
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
    </section>
  );
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
