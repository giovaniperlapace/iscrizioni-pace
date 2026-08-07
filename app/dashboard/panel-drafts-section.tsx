import Link from "next/link";
import { Plus, Search, X } from "lucide-react";

import { savePanelDraft } from "@/app/actions";
import { PanelDraftFields } from "@/app/dashboard/panel-draft-fields";
import { PanelPublicationTable } from "@/app/dashboard/panel-publication-table";
import { PanelTabs } from "@/app/dashboard/school-bookings-section";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import type { EventLocationOption } from "@/lib/panels/event-locations";
import {
  PANEL_SEARCH_MAX_LENGTH,
  filterPanelDrafts,
  panelDateKey,
  panelDateTimeLocalValue,
  type PanelAudienceTypeOption,
  type PanelDraftFilters,
  type PanelDraftRow,
} from "@/lib/panels/panel-drafts";

type PanelDraftsSectionProps = {
  dashboard: "admin" | "manager";
  navMode: "full" | "mini";
  event: { id: string; title: string; startsOn: string; endsOn: string } | null;
  panels: PanelDraftRow[];
  locations: EventLocationOption[];
  audienceTypes: PanelAudienceTypeOption[];
  selectedPanel: PanelDraftRow | null;
  isCreating: boolean;
  canManage: boolean;
  filters: PanelDraftFilters;
  error?: string;
  saved?: string;
};

export function PanelDraftsSection({
  dashboard,
  navMode,
  event,
  panels,
  locations,
  audienceTypes,
  selectedPanel,
  isCreating,
  canManage,
  filters,
  error,
  saved,
}: PanelDraftsSectionProps) {
  const filteredPanels = filterPanelDrafts(panels, filters);
  const basePath = panelDraftsPath(dashboard, navMode);
  const closePath = panelDraftsPath(dashboard, navMode, filters);
  const dates = [...new Set(panels.map((panel) => panelDateKey(panel.startsAt)).filter(Boolean))];

  return (
    <section className="grid min-w-0 gap-5">
      <div className="rounded-lg border border-[var(--peace-border)] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--peace-blue-700)]">
              Panel
            </p>
            <h2 className="mt-1 text-xl font-semibold">Catalogo panel</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--peace-muted)]">
              Prepara contenuti, orari, location e quote di posti, poi pubblica
              singoli panel o una selezione completa.
            </p>
          </div>
          {canManage && event ? (
            <Link
              href={`${closePath}&panelTool=new`}
              scroll={false}
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--peace-blue-900)]"
            >
              <Plus className="size-4" aria-hidden="true" />
              Nuovo panel
            </Link>
          ) : null}
        </div>

        <PanelTabs dashboard={dashboard} navMode={navMode} active="panels" />

        <PanelStatus error={error} saved={saved} />

        {!canManage && event ? (
          <p className="mt-5 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] px-4 py-3 text-sm text-[var(--peace-muted)]">
            Vista in sola lettura. Il ruolo manager viewer può consultare panel e
            distribuzione dei posti, ma non modificarli.
          </p>
        ) : null}

        {event ? (
          <form
            action={`/dashboard/${dashboard}`}
            method="get"
            className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(14rem,1fr)_11rem_11rem_13rem_auto] xl:items-end"
          >
            <input type="hidden" name="section" value="panel" />
            <input type="hidden" name="panelView" value="panels" />
            <input type="hidden" name="nav" value={navMode} />
            <label className="grid gap-1 text-sm font-semibold">
              Cerca
              <span className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--peace-muted)]" aria-hidden="true" />
                <input
                  name="panelQ"
                  defaultValue={filters.query}
                  className="field w-full pl-9 font-normal"
                  maxLength={PANEL_SEARCH_MAX_LENGTH}
                  placeholder="Titolo, descrizione o location"
                />
              </span>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Stato
              <select name="panelStatus" defaultValue={filters.status} className="field font-normal">
                <option value="all">Tutti</option>
                <option value="draft">Bozza</option>
                <option value="published">Pubblicato</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Data
              <select name="panelDate" defaultValue={filters.date} className="field font-normal">
                <option value="">Tutte</option>
                {dates.map((date) => (
                  <option key={date} value={date}>{formatDate(date)}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Location
              <select name="panelLocation" defaultValue={filters.locationId} className="field font-normal">
                <option value="all">Tutte</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>{location.name}</option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <PendingSubmitButton className="min-h-11 rounded-md border border-[var(--peace-border-strong)] px-4 text-sm font-semibold text-[var(--peace-blue-800)]">
                Filtra
              </PendingSubmitButton>
              {hasFilters(filters) ? (
                <Link href={basePath} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-[var(--peace-blue-800)]">
                  Azzera
                </Link>
              ) : null}
            </div>
          </form>
        ) : null}

        {!event ? (
          <p className="mt-5 text-sm text-[var(--peace-muted)]">Nessun evento operativo corrente disponibile.</p>
        ) : (
          <PanelPublicationTable
            panels={filteredPanels}
            totalCount={panels.length}
            dashboard={dashboard}
            navMode={navMode}
            eventId={event.id}
            panelPath={panelDraftsPath(dashboard, navMode, filters)}
            canManage={canManage}
          />
        )}
      </div>

      {event && (isCreating || selectedPanel) ? (
        <PanelOverlay
          dashboard={dashboard}
          navMode={navMode}
          event={event}
          panel={selectedPanel}
          panels={panels}
          locations={locations}
          audienceTypes={audienceTypes}
          canManage={canManage}
          closePath={closePath}
        />
      ) : null}
    </section>
  );
}

function PanelOverlay({ dashboard, navMode, event, panel, panels, locations, audienceTypes, canManage, closePath }: { dashboard: "admin" | "manager"; navMode: "full" | "mini"; event: { id: string; title: string; startsOn: string; endsOn: string }; panel: PanelDraftRow | null; panels: PanelDraftRow[]; locations: EventLocationOption[]; audienceTypes: PanelAudienceTypeOption[]; canManage: boolean; closePath: string }) {
  const canEdit = canManage;
  return (
    <div className="dashboard-modal fixed inset-0 z-40 grid place-items-center bg-black/35 px-4 py-6">
      <div role="dialog" aria-modal="true" aria-labelledby="panel-dialog-title" className="grid max-h-[94vh] w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--peace-border)] px-5 py-4">
          <div>
            <h3 id="panel-dialog-title" className="text-xl font-semibold">{panel ? (canEdit ? "Modifica panel" : "Dettaglio panel") : "Nuovo panel"}</h3>
            <p className="mt-1 text-sm text-[var(--peace-muted)]">{event.title} · orari Europe/Rome</p>
          </div>
          <Link href={closePath} scroll={false} className="inline-flex size-10 items-center justify-center rounded-md border border-[var(--peace-border-strong)] text-[var(--peace-blue-800)]" aria-label="Chiudi modale panel">
            <X className="size-5" aria-hidden="true" />
          </Link>
        </div>
        {canEdit ? (
          <form action={savePanelDraft} className="grid overflow-y-auto" data-preserve-dashboard-scroll>
            <input type="hidden" name="sourceDashboard" value={dashboard} />
            <input type="hidden" name="eventId" value={event.id} />
            <input type="hidden" name="nav" value={navMode} />
            {panel ? <input type="hidden" name="panelId" value={panel.id} /> : null}
            {panel ? <input type="hidden" name="publicationStatus" value={panel.publicationStatus} /> : null}
            <div className="px-5 py-5">
              {panel?.publicationStatus === "published" ? (
                <div className="mb-5 grid gap-2 rounded-md border border-[#c9d9e7] bg-[#f2f8fc] px-4 py-3 text-sm">
                  <p className="font-semibold">Modifica di un panel già pubblico</p>
                  <p className="text-[var(--peace-muted)]">
                    Le modifiche sono subito visibili nel programma e vengono registrate in audit.
                    {panel.confirmedRegistrationCount > 0
                      ? ` Le persone già iscritte coinvolte sono ${panel.confirmedRegistrationCount}.`
                      : " Non risultano ancora persone iscritte a questo panel."}
                  </p>
                  {panel.confirmedRegistrationCount > 0 ? (
                    <Link
                      href={`/dashboard/manager?section=email&nav=${navMode}&campaignPanel=${encodeURIComponent(panel.id)}`}
                      className="w-fit text-xs font-semibold text-[var(--peace-blue-800)] underline decoration-1 underline-offset-4"
                    >
                      Prepara una comunicazione per le persone iscritte a questo panel
                    </Link>
                  ) : null}
                </div>
              ) : null}
              <PanelDraftFields panel={panel} locations={locations} audienceTypes={audienceTypes} startsAt={panelDateTimeLocalValue(panel?.startsAt ?? null)} endsAt={panelDateTimeLocalValue(panel?.endsAt ?? null)} eventStartsOn={event.startsOn} eventEndsOn={event.endsOn} conflictPanels={panels.map((candidate) => ({ id: candidate.id, title: candidate.title, locationId: candidate.locationId, startsAt: candidate.startsAt, endsAt: candidate.endsAt }))} />
            </div>
            <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--peace-border)] px-5 py-4">
              <Link href={closePath} scroll={false} className="inline-flex min-h-11 items-center rounded-md border border-[var(--peace-border-strong)] px-4 text-sm font-semibold">Annulla</Link>
              <PendingSubmitButton className="min-h-11 rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white">
                {panel?.publicationStatus === "published" ? "Salva e aggiorna" : panel ? "Salva modifiche" : "Salva bozza"}
              </PendingSubmitButton>
            </div>
          </form>
        ) : (
          <div className="grid gap-4 overflow-y-auto px-5 py-5 text-sm">
            <p>Il panel è disponibile in sola lettura per il tuo ruolo.</p>
            {panel?.description ? <p className="whitespace-pre-wrap leading-6 text-[var(--peace-muted)]">{panel.description}</p> : null}
            <dl className="grid gap-3 rounded-md border border-[var(--peace-border)] p-4 sm:grid-cols-2">
              <Detail label="Orario" value={formatSchedule(panel!)} />
              <Detail label="Location" value={panel?.locationName ?? "Non indicata"} />
              <Detail label="Posti assegnati" value={String(panel?.assignedCapacity ?? 0)} />
              <Detail label="Capienza" value={panel?.locationCapacity?.toString() ?? "Non definita"} />
            </dl>
            <div>
              <h4 className="font-semibold">Sezioni di posti</h4>
              {panel && panel.sections.length > 0 ? (
                <ul className="mt-2 grid gap-2">
                  {panel.sections.map((seatSection) => (
                    <li key={seatSection.id} className="flex justify-between gap-3 rounded-md bg-[#f7fbfe] px-3 py-2">
                      <span>{seatSection.audienceName}</span>
                      <span className="font-semibold tabular-nums">{seatSection.capacity} posti</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[var(--peace-muted)]">Nessuna sezione configurata.</p>
              )}
            </div>
            <Link href={closePath} className="btn-secondary justify-self-end">Chiudi</Link>
          </div>
        )}
      </div>
    </div>
  );
}

function PanelStatus({ error, saved }: { error?: string; saved?: string }) {
  if (saved) {
    const messages: Record<string, string> = {
      created: "Bozza panel creata.",
      updated: "Bozza panel aggiornata.",
      published: "Panel pubblicato.",
      "batch-published": "I panel selezionati sono stati pubblicati.",
      "already-published": "I panel selezionati risultano già pubblicati.",
      "published-updated": "Panel pubblico aggiornato.",
    };
    return <p className="mt-5 rounded-md border border-[#bbd7bd] bg-[#eef8ef] px-3 py-2 text-sm text-[#255532]">{messages[saved] ?? "Operazione panel completata."}</p>;
  }
  if (!error) return null;
  const messages: Record<string, string> = {
    invalid: "Controlla titolo, descrizione, orari, location e sezioni.",
    forbidden: "Non hai permessi di modifica sui panel di questo evento.",
    "not-found": "Il panel non è stato trovato o non è più modificabile.",
    "duplicate-audience": "Ogni tipo di pubblico può comparire una sola volta.",
    overlap: "La location è già occupata da un altro panel in questa fascia oraria.",
    "outside-event": "Gli orari devono rientrare nelle date dell'evento.",
    "booked-capacity": "La quota per gli iscritti non può scendere sotto le prenotazioni già confermate.",
    "capacity-total": "Per un panel pubblico, il totale delle sezioni deve coincidere con la capienza della location.",
    "publish-selection": "Seleziona almeno una bozza da pubblicare.",
    "publish-invalid": "La selezione contiene un panel incompleto: nessun panel è stato pubblicato.",
    "publish-failed": "Non è stato possibile pubblicare i panel selezionati. Nessun panel è stato modificato.",
  };
  return <p className="mt-5 rounded-md border border-[#e0b5a9] bg-[#fff3ef] px-3 py-2 text-sm text-[#8a3323]">{messages[error] ?? "Non è stato possibile salvare la bozza."}</p>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-bold uppercase tracking-wide text-[var(--peace-muted)]">{label}</dt><dd className="mt-1">{value}</dd></div>;
}

function formatSchedule(panel: PanelDraftRow): string {
  if (!panel.startsAt || !panel.endsAt) return "Orario da definire";
  const formatter = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  return `${formatter.format(new Date(panel.startsAt))} – ${formatter.format(new Date(panel.endsAt))}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", day: "2-digit", month: "long", year: "numeric" }).format(new Date(`${value}T00:00:00Z`));
}

function hasFilters(filters: PanelDraftFilters): boolean {
  return Boolean(filters.query || filters.status !== "all" || filters.date || filters.locationId !== "all");
}

function panelDraftsPath(dashboard: "admin" | "manager", navMode: "full" | "mini", filters?: PanelDraftFilters): string {
  const params = new URLSearchParams({ section: "panel", panelView: "panels", nav: navMode });
  if (filters?.query) params.set("panelQ", filters.query);
  if (filters?.status !== undefined && filters.status !== "all") params.set("panelStatus", filters.status);
  if (filters?.date) params.set("panelDate", filters.date);
  if (filters?.locationId !== undefined && filters.locationId !== "all") params.set("panelLocation", filters.locationId);
  return `/dashboard/${dashboard}?${params.toString()}`;
}
