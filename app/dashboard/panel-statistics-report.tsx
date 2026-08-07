"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  Baby,
  CalendarDays,
  CheckCircle2,
  CircleGauge,
  Mail,
  MapPin,
  School,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  summarizePanelStatistics,
  type PanelStatisticsRow,
  type PanelStatisticsSnapshot,
  type PanelStatisticsState,
} from "@/lib/panels/panel-statistics";

const ALL_FILTER = "all";
const PANEL_STATES: PanelStatisticsState[] = [
  "full",
  "nearly_full",
  "not_configured",
  "inconsistent",
  "available",
];

export function PanelStatisticsReport({
  statistics,
  dashboard,
  navMode,
  canManage,
}: {
  statistics: PanelStatisticsSnapshot;
  dashboard: "admin" | "manager";
  navMode: "full" | "mini";
  canManage: boolean;
}) {
  const [dayFilter, setDayFilter] = useState(ALL_FILTER);
  const [locationFilter, setLocationFilter] = useState(ALL_FILTER);
  const [panelFilter, setPanelFilter] = useState(ALL_FILTER);
  const [audienceFilter, setAudienceFilter] = useState(ALL_FILTER);
  const [stateFilter, setStateFilter] = useState(ALL_FILTER);

  const filteredPanels = useMemo(
    () =>
      statistics.panels.filter(
        (panel) =>
          (dayFilter === ALL_FILTER || panel.day === dayFilter) &&
          (locationFilter === ALL_FILTER ||
            panel.locationId === locationFilter) &&
          (panelFilter === ALL_FILTER || panel.id === panelFilter) &&
          (audienceFilter === ALL_FILTER ||
            panel.sections.some(
              (section) => section.audienceTypeId === audienceFilter
            )) &&
          (stateFilter === ALL_FILTER || panel.state === stateFilter)
      ),
    [
      statistics.panels,
      dayFilter,
      locationFilter,
      panelFilter,
      audienceFilter,
      stateFilter,
    ]
  );
  const filteredSummary = useMemo(
    () => summarizePanelStatistics(filteredPanels),
    [filteredPanels]
  );

  function selectState(state: PanelStatisticsState) {
    setStateFilter((current) => (current === state ? ALL_FILTER : state));
  }

  return (
    <article className="rounded-lg border border-[var(--peace-border)] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold">Capienza e prenotazioni panel</h3>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-[var(--peace-muted)]">
            I conteggi usano le scelte panel confermate e le prenotazioni scuola
            attive. Le iscrizioni annullate e le riserve cancellate non occupano
            posti.
          </p>
        </div>
        <span className="inline-flex min-h-8 items-center rounded-full bg-[#eef5fa] px-3 text-xs font-semibold text-[var(--peace-blue-900)]">
          Sola lettura
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <PanelSummaryCard
          icon={CalendarDays}
          label="Panel filtrati"
          value={filteredSummary.panelCount}
        />
        <PanelSummaryCard
          icon={Users}
          label="Posti prenotati"
          value={filteredSummary.bookedPeople}
        />
        <PanelSummaryCard
          icon={CircleGauge}
          label="Posti residui"
          value={filteredSummary.remainingSeats}
        />
        <PanelSummaryCard
          icon={Baby}
          label="Minori ereditati"
          value={filteredSummary.inheritedChildren}
        />
        <PanelSummaryCard
          icon={School}
          label="Scuole · prenotazioni/persone"
          value={`${filteredSummary.schoolBookings}/${filteredSummary.schoolPeople}`}
        />
      </div>

      {filteredSummary.overCapacitySeats > 0 ? (
        <p
          role="alert"
          className="mt-3 flex items-center gap-2 rounded-md border border-[#e4b1ac] bg-[#fff2f0] px-3 py-2 text-sm font-semibold text-[#9f2f25]"
        >
          <AlertTriangle aria-hidden="true" size={17} />
          {filteredSummary.overCapacitySeats} posti oltre la capienza configurata.
        </p>
      ) : null}

      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {PANEL_STATES.map((state) => (
          <button
            key={state}
            type="button"
            onClick={() => selectState(state)}
            aria-pressed={stateFilter === state}
            className={`flex min-h-11 items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--peace-blue-800)] ${
              stateFilter === state
                ? "border-[var(--peace-blue-800)] bg-[#eef7fc]"
                : "border-[var(--peace-border)] bg-white hover:border-[var(--peace-border-strong)]"
            }`}
          >
            <span className="font-medium">{panelStateLabel(state)}</span>
            <span className="font-semibold tabular-nums">
              {statistics.summary.stateCounts[state]}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <PanelFilter
          label="Giorno"
          value={dayFilter}
          onChange={setDayFilter}
          allLabel="Tutti i giorni"
          options={statistics.days.map((day) => ({
            value: day,
            label: formatPanelDay(day),
          }))}
        />
        <PanelFilter
          label="Location"
          value={locationFilter}
          onChange={setLocationFilter}
          allLabel="Tutte le location"
          options={statistics.locations.map((location) => ({
            value: location.id,
            label: location.name,
          }))}
        />
        <PanelFilter
          label="Panel"
          value={panelFilter}
          onChange={setPanelFilter}
          allLabel="Tutti i panel"
          options={statistics.panels.map((panel) => ({
            value: panel.id,
            label: panel.title,
          }))}
        />
        <PanelFilter
          label="Tipo pubblico"
          value={audienceFilter}
          onChange={setAudienceFilter}
          allLabel="Tutti i pubblici"
          options={statistics.audienceTypes.map((audience) => ({
            value: audience.id,
            label: audience.name,
          }))}
        />
      </div>

      <p className="mt-4 text-sm text-[var(--peace-muted)]" aria-live="polite">
        {filteredPanels.length === statistics.panels.length
          ? `${filteredPanels.length} ${filteredPanels.length === 1 ? "panel" : "panel"}`
          : `${filteredPanels.length} di ${statistics.panels.length} panel`}
      </p>

      <div className="mt-3 grid gap-4">
        {filteredPanels.map((panel) => (
          <PanelStatisticsCard
            key={panel.id}
            panel={panel}
            audienceFilter={audienceFilter}
            dashboard={dashboard}
            navMode={navMode}
            canManage={canManage}
          />
        ))}
      </div>

      {statistics.panels.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-[var(--peace-border-strong)] px-4 py-5 text-sm text-[var(--peace-muted)]">
          Nessun panel configurato per l’evento corrente.
        </p>
      ) : filteredPanels.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--peace-muted)]">
          Nessun panel corrisponde ai filtri impostati.
        </p>
      ) : null}

      {!statistics.actualAttendanceAvailable ? (
        <div className="mt-5 rounded-md border border-dashed border-[#b9cbd9] bg-[#f7fbfe] px-4 py-3">
          <p className="text-sm font-semibold text-[var(--peace-ink)]">
            Presenze effettive e no-show
          </p>
          <p className="mt-1 text-sm leading-6 text-[var(--peace-muted)]">
            Il confronto previsto/effettivo sarà disponibile dopo l’introduzione
            del check-in individuale, dei minori e delle scuole nella Milestone
            P11. Questa vista non usa i check-in legacy per evitare confronti
            parziali o fuorvianti.
          </p>
        </div>
      ) : null}
    </article>
  );
}

function PanelStatisticsCard({
  panel,
  audienceFilter,
  dashboard,
  navMode,
  canManage,
}: {
  panel: PanelStatisticsRow;
  audienceFilter: string;
  dashboard: "admin" | "manager";
  navMode: "full" | "mini";
  canManage: boolean;
}) {
  const visibleSections =
    audienceFilter === ALL_FILTER
      ? panel.sections
      : panel.sections.filter(
          (section) => section.audienceTypeId === audienceFilter
        );
  const dashboardPath =
    dashboard === "admin" ? "/dashboard/admin" : "/dashboard/manager";
  const panelHref = `${dashboardPath}?section=panel&panelView=panels&nav=${navMode}&panelId=${encodeURIComponent(panel.id)}`;
  const campaignHref = `/dashboard/manager?section=email&nav=${navMode}&campaignPanel=${encodeURIComponent(panel.id)}`;

  return (
    <section className="overflow-hidden rounded-lg border border-[var(--peace-border)] [content-visibility:auto] [contain-intrinsic-size:auto_34rem]">
      <header className="grid gap-4 bg-[#f7fbfe] px-4 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-base font-semibold text-[var(--peace-ink)]">
              {panel.title}
            </h4>
            <PanelStateBadge state={panel.state} />
            <span className="rounded-full border border-[var(--peace-border)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--peace-muted)]">
              {panel.publicationStatus === "published" ? "Pubblicato" : "Bozza"}
            </span>
          </div>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--peace-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays aria-hidden="true" size={15} />
              {formatPanelSchedule(panel.startsAt, panel.endsAt)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin aria-hidden="true" size={15} />
              {panel.locationName}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={panelHref}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--peace-border-strong)] bg-white px-3 text-sm font-semibold text-[var(--peace-blue-800)]"
          >
            {canManage ? "Gestisci panel" : "Apri panel"}
            <ArrowUpRight aria-hidden="true" size={16} />
          </Link>
          {canManage && panel.publicationStatus === "published" ? (
            <Link
              href={campaignHref}
              className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[var(--peace-blue-800)] px-3 text-sm font-semibold text-white"
            >
              <Mail aria-hidden="true" size={16} />
              Campagna filtrata
            </Link>
          ) : null}
        </div>
      </header>

      <div className="grid gap-3 border-t border-[var(--peace-border)] px-4 py-4 sm:grid-cols-2 lg:grid-cols-5">
        <PanelMetric label="Capienza" value={panel.capacity} />
        <PanelMetric
          label="Partecipanti individuali"
          value={panel.individualPeople}
          detail={`${panel.individualBookings} iscrizioni`}
        />
        <PanelMetric label="Minori ereditati" value={panel.inheritedChildren} />
        <PanelMetric
          label="Scuole"
          value={panel.schoolPeople}
          detail={`${panel.schoolBookings} prenotazioni`}
        />
        <PanelMetric
          label="Posti residui"
          value={Math.max(0, panel.remainingSeats)}
          detail={
            panel.remainingSeats < 0
              ? `${Math.abs(panel.remainingSeats)} oltre capienza`
              : panel.utilizationPercent === null
                ? "Percentuale non calcolabile"
                : `${panel.utilizationPercent}% occupato`
          }
          alert={panel.remainingSeats < 0}
        />
      </div>

      {panel.issues.length > 0 ? (
        <div className="mx-4 mb-4 flex gap-2 rounded-md border border-[#e6c989] bg-[#fff9e9] px-3 py-2 text-sm text-[#755514]">
          <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0" size={17} />
          <span>{panel.issues.join(" · ")}</span>
        </div>
      ) : null}

      <div className="border-t border-[var(--peace-border)] px-4 py-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h5 className="text-sm font-semibold">Dettaglio per tipo pubblico</h5>
            <p className="mt-1 text-xs text-[var(--peace-muted)]">
              Adulti individuali, minori collegati e persone scuola restano
              separati e si sommano nella colonna prenotati.
            </p>
          </div>
          <span className="text-xs text-[var(--peace-muted)]">
            Capienza location: {panel.locationCapacity ?? "da definire"}
          </span>
        </div>
        <div className="mt-3 overflow-x-auto rounded-md border border-[var(--peace-border)]">
          <table className="w-full min-w-[840px] border-collapse text-left text-sm">
            <thead className="bg-[#f7fbfe] text-xs uppercase tracking-wide text-[#6f7f91]">
              <tr className="border-b border-[var(--peace-border)]">
                <th className="px-3 py-2.5 font-semibold">Pubblico</th>
                <th className="px-3 py-2.5 text-right font-semibold">Capienza</th>
                <th className="px-3 py-2.5 text-right font-semibold">Iscrizioni</th>
                <th className="px-3 py-2.5 text-right font-semibold">Minori</th>
                <th className="px-3 py-2.5 text-right font-semibold">Pren. scuola</th>
                <th className="px-3 py-2.5 text-right font-semibold">Persone scuola</th>
                <th className="px-3 py-2.5 text-right font-semibold">Prenotati</th>
                <th className="px-3 py-2.5 text-right font-semibold">Residui</th>
              </tr>
            </thead>
            <tbody>
              {visibleSections.map((section) => (
                <tr
                  key={section.id}
                  className="border-b border-[var(--peace-border)] last:border-b-0"
                >
                  <td className="px-3 py-2.5 font-medium">
                    {section.audienceName}
                    {section.isInconsistent ? (
                      <span className="ml-2 text-xs font-semibold text-[#9f2f25]">
                        Da verificare
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {section.capacity}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {section.individualBookings}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {section.inheritedChildren}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {section.schoolBookings}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {section.schoolPeople}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                    {section.bookedPeople}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right font-semibold tabular-nums ${
                      section.remainingSeats < 0 ? "text-[#9f2f25]" : ""
                    }`}
                  >
                    {section.remainingSeats}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visibleSections.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--peace-muted)]">
            Nessuna sezione corrisponde al tipo pubblico selezionato.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function PanelSummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--peace-border)] bg-[#f7fbfe] p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-[var(--peace-blue-800)] shadow-sm">
        <Icon aria-hidden="true" size={18} />
      </span>
      <span>
        <span className="block text-xl font-semibold tabular-nums text-[var(--peace-ink)]">
          {value}
        </span>
        <span className="block text-xs leading-4 text-[var(--peace-muted)]">
          {label}
        </span>
      </span>
    </div>
  );
}

function PanelMetric({
  label,
  value,
  detail,
  alert = false,
}: {
  label: string;
  value: number;
  detail?: string;
  alert?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-[#6f7f91]">
        {label}
      </p>
      <p
        className={`mt-1 text-xl font-semibold tabular-nums ${
          alert ? "text-[#9f2f25]" : "text-[var(--peace-ink)]"
        }`}
      >
        {value}
      </p>
      {detail ? (
        <p className="mt-0.5 text-xs text-[var(--peace-muted)]">{detail}</p>
      ) : null}
    </div>
  );
}

function PanelFilter({
  label,
  value,
  onChange,
  allLabel,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[#6f7f91]">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded-md border border-[var(--peace-border)] bg-white px-3 text-sm font-normal normal-case tracking-normal text-[var(--peace-ink)]"
      >
        <option value={ALL_FILTER}>{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PanelStateBadge({ state }: { state: PanelStatisticsState }) {
  const classes =
    state === "full" || state === "inconsistent"
      ? "border-[#e4b1ac] bg-[#fff2f0] text-[#9f2f25]"
      : state === "nearly_full" || state === "not_configured"
        ? "border-[#e6c989] bg-[#fff9e9] text-[#755514]"
        : "border-[#add7bf] bg-[#edf8f1] text-[#167548]";
  const Icon = state === "available" ? CheckCircle2 : AlertTriangle;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${classes}`}
    >
      <Icon aria-hidden="true" size={13} />
      {panelStateLabel(state)}
    </span>
  );
}

function panelStateLabel(state: PanelStatisticsState): string {
  switch (state) {
    case "available":
      return "Disponibile";
    case "nearly_full":
      return "Quasi pieno";
    case "full":
      return "Pieno";
    case "not_configured":
      return "Non configurato";
    case "inconsistent":
      return "Incoerente";
  }
}

function formatPanelDay(value: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatPanelSchedule(
  startsAt: string | null,
  endsAt: string | null
): string {
  if (!startsAt || !endsAt) {
    return "Data e orario da definire";
  }

  const formatter = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const endFormatter = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${formatter.format(new Date(startsAt))}–${endFormatter.format(
    new Date(endsAt)
  )}`;
}
