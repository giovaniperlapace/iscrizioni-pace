import Link from "next/link";
import { Pencil, Plus, Search, X } from "lucide-react";

import { deleteEventLocation, saveEventLocation } from "@/app/actions";
import { ConfirmSubmitButton } from "@/app/dashboard/confirm-submit-button";
import { PanelTabs } from "@/app/dashboard/school-bookings-section";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  EVENT_LOCATION_ADDRESS_MAX_LENGTH,
  EVENT_LOCATION_NAME_MAX_LENGTH,
  EVENT_LOCATION_SEARCH_MAX_LENGTH,
  filterEventLocations,
  type EventLocationOption,
} from "@/lib/panels/event-locations";

type PanelLocationsSectionProps = {
  dashboard: "admin" | "manager";
  navMode: "full" | "mini";
  event: { id: string; title: string } | null;
  locations: EventLocationOption[];
  selectedLocation: EventLocationOption | null;
  isCreating: boolean;
  canManage: boolean;
  query: string;
  error?: string;
  saved?: string;
};

export function PanelLocationsSection({
  dashboard,
  navMode,
  event,
  locations,
  selectedLocation,
  isCreating,
  canManage,
  query,
  error,
  saved,
}: PanelLocationsSectionProps) {
  const filteredLocations = filterEventLocations(locations, query);
  const basePath = panelLocationsPath(dashboard, navMode);

  return (
    <section className="grid min-w-0 gap-5">
      <div className="rounded-lg border border-[var(--peace-border)] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--peace-blue-700)]">
              Panel
            </p>
            <h2 className="mt-1 text-xl font-semibold">Location</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--peace-muted)]">
              Configura gli spazi fisici dell&apos;evento e la loro capienza massima.
              Ogni sala può ospitare un solo panel nella stessa fascia oraria.
            </p>
          </div>
          {canManage && event ? (
            <Link
              href={`${basePath}&locationTool=new`}
              scroll={false}
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--peace-blue-900)]"
            >
              <Plus className="size-4" aria-hidden="true" />
              Nuova location
            </Link>
          ) : null}
        </div>

        <PanelTabs dashboard={dashboard} navMode={navMode} active="locations" />

        <LocationStatus error={error} saved={saved} />

        {!canManage && event ? (
          <p className="mt-5 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] px-4 py-3 text-sm text-[var(--peace-muted)]">
            Vista in sola lettura. Il ruolo manager viewer può consultare location,
            capienze e panel associati, ma non modificarli.
          </p>
        ) : null}

        {event ? (
          <form
            action={`/dashboard/${dashboard}`}
            method="get"
            className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <input type="hidden" name="section" value="panel" />
            <input type="hidden" name="nav" value={navMode} />
            <input type="hidden" name="panelView" value="locations" />
            <label className="grid flex-1 gap-1 text-sm font-semibold text-[var(--peace-ink)]">
              Cerca location
              <span className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--peace-muted)]" aria-hidden="true" />
                <input
                  name="locationQ"
                  defaultValue={query}
                  className="field w-full pl-9 font-normal"
                  maxLength={EVENT_LOCATION_SEARCH_MAX_LENGTH}
                  placeholder="Nome, indirizzo o panel"
                />
              </span>
            </label>
            <PendingSubmitButton className="min-h-11 rounded-md border border-[var(--peace-border-strong)] px-4 text-sm font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]">
              Cerca
            </PendingSubmitButton>
            {query ? (
              <Link href={basePath} className="inline-flex min-h-11 items-center justify-center px-3 text-sm font-semibold text-[var(--peace-blue-800)]">
                Azzera
              </Link>
            ) : null}
          </form>
        ) : null}

        {!event ? (
          <p className="mt-5 text-sm text-[var(--peace-muted)]">
            Nessun evento operativo corrente disponibile.
          </p>
        ) : (
          <LocationResults
            locations={filteredLocations}
            totalCount={locations.length}
            dashboard={dashboard}
            navMode={navMode}
            canManage={canManage}
          />
        )}
      </div>

      {event && (isCreating || selectedLocation) ? (
        <LocationOverlay
          dashboard={dashboard}
          navMode={navMode}
          event={event}
          location={selectedLocation}
          canManage={canManage}
        />
      ) : null}
    </section>
  );
}

function LocationResults({
  locations,
  totalCount,
  dashboard,
  navMode,
  canManage,
}: {
  locations: EventLocationOption[];
  totalCount: number;
  dashboard: "admin" | "manager";
  navMode: "full" | "mini";
  canManage: boolean;
}) {
  if (locations.length === 0) {
    return (
      <p className="mt-5 rounded-md border border-dashed border-[var(--peace-border-strong)] px-4 py-6 text-center text-sm text-[var(--peace-muted)]">
        {totalCount === 0
          ? "Nessuna location configurata per l'evento corrente."
          : "Nessuna location corrisponde alla ricerca."}
      </p>
    );
  }

  return (
    <>
      <p className="mt-4 text-xs text-[var(--peace-muted)]" aria-live="polite">
        {locations.length} {locations.length === 1 ? "location" : "location"}
      </p>

      <div className="mt-3 grid gap-3 md:hidden">
        {locations.map((location) => (
          <article key={location.id} className="rounded-md border border-[var(--peace-border)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{location.name}</h3>
                <p className="mt-1 text-sm text-[var(--peace-muted)]">
                  {location.address ?? "Indirizzo non indicato"}
                </p>
              </div>
              <span className="whitespace-nowrap rounded-full bg-[var(--peace-sky-100)] px-2.5 py-1 text-xs font-bold text-[var(--peace-blue-800)]">
                {location.maxCapacity === null
                  ? "Capienza da definire"
                  : `${location.maxCapacity} posti`}
              </span>
            </div>
            <LocationPanelList panels={location.panels} />
            {canManage ? (
              <Link
                href={locationEditPath(dashboard, navMode, location.id)}
                scroll={false}
                className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--peace-border-strong)] px-3 text-sm font-semibold text-[var(--peace-blue-800)]"
              >
                <Pencil className="size-4" aria-hidden="true" />
                Modifica
              </Link>
            ) : null}
          </article>
        ))}
      </div>

      <div className="mt-3 hidden overflow-x-auto md:block">
        <table className="w-full min-w-[880px] table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[27%]" />
            <col className="w-[12%]" />
            <col className="w-[27%]" />
            <col className="w-[12%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-[var(--peace-border)] text-xs uppercase tracking-wide text-[#6f7f91]">
              <th className="py-3 pr-4 font-semibold">Location</th>
              <th className="py-3 pr-4 font-semibold">Indirizzo</th>
              <th className="py-3 pr-4 font-semibold">Capienza</th>
              <th className="py-3 pr-4 font-semibold">Panel associati</th>
              <th className="py-3 pl-4 text-right font-semibold">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {locations.map((location) => (
              <tr key={location.id} className="border-b border-[var(--peace-border)] align-top last:border-b-0">
                <td className="py-4 pr-4 font-semibold">{location.name}</td>
                <td className="py-4 pr-4 leading-6 text-[var(--peace-muted)]">
                  {location.address ?? "Non indicato"}
                </td>
                <td className="py-4 pr-4 font-semibold tabular-nums">
                  {location.maxCapacity === null
                    ? "Da definire"
                    : `${location.maxCapacity} posti`}
                </td>
                <td className="py-4 pr-4">
                  <LocationPanelList panels={location.panels} compact />
                </td>
                <td className="py-4 pl-4 text-right">
                  {canManage ? (
                    <Link
                      href={locationEditPath(dashboard, navMode, location.id)}
                      scroll={false}
                      className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--peace-border-strong)] px-3 font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]"
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                      Modifica
                    </Link>
                  ) : (
                    <span className="text-xs text-[var(--peace-muted)]">Sola lettura</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function LocationPanelList({
  panels,
  compact = false,
}: {
  panels: EventLocationOption["panels"];
  compact?: boolean;
}) {
  if (panels.length === 0) {
    return <p className={compact ? "text-sm text-[var(--peace-muted)]" : "mt-3 text-sm text-[var(--peace-muted)]"}>Nessun panel associato</p>;
  }

  return (
    <ul className={compact ? "grid gap-1.5" : "mt-3 grid gap-1.5"}>
      {panels.map((panel) => (
        <li key={panel.id} className="flex flex-wrap items-center gap-2 text-sm">
          <span>{panel.title}</span>
          <span
            className={[
              "rounded-full px-2 py-0.5 text-[0.68rem] font-bold uppercase tracking-wide",
              panel.publicationStatus === "published"
                ? "bg-[#e7f4e9] text-[#255532]"
                : "bg-[#eef3f7] text-[#536579]",
            ].join(" ")}
          >
            {panel.publicationStatus === "published" ? "Pubblicato" : "Bozza"}
          </span>
        </li>
      ))}
    </ul>
  );
}

function LocationOverlay({
  dashboard,
  navMode,
  event,
  location,
  canManage,
}: {
  dashboard: "admin" | "manager";
  navMode: "full" | "mini";
  event: { id: string; title: string };
  location: EventLocationOption | null;
  canManage: boolean;
}) {
  const isEditing = Boolean(location);
  const publishedPanels = location?.panels.filter(
    (panel) => panel.publicationStatus === "published"
  ) ?? [];
  const closePath = panelLocationsPath(dashboard, navMode);

  return (
    <div className="dashboard-modal fixed inset-0 z-40 grid place-items-center bg-black/35 px-4 py-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-dialog-title"
        className="grid max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--peace-border)] px-5 py-4">
          <div>
            <h3 id="location-dialog-title" className="text-xl font-semibold">
              {isEditing ? "Modifica location" : "Nuova location"}
            </h3>
            <p className="mt-1 text-sm text-[var(--peace-muted)]">{event.title}</p>
          </div>
          <Link
            href={closePath}
            scroll={false}
            className="inline-flex size-10 items-center justify-center rounded-md border border-[var(--peace-border-strong)] text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]"
            aria-label="Chiudi modale location"
          >
            <X className="size-5" aria-hidden="true" />
          </Link>
        </div>

        {canManage ? (
          <form action={saveEventLocation} className="grid overflow-y-auto" data-preserve-dashboard-scroll>
            <input type="hidden" name="sourceDashboard" value={dashboard} />
            <input type="hidden" name="eventId" value={event.id} />
            <input type="hidden" name="nav" value={navMode} />
            {location ? <input type="hidden" name="locationId" value={location.id} /> : null}
            <div className="grid gap-4 px-5 py-5">
              <label className="grid gap-2 text-sm font-semibold text-[var(--peace-ink)]">
                Nome location
                <input
                  name="name"
                  defaultValue={location?.name ?? ""}
                  className="field font-normal"
                  maxLength={EVENT_LOCATION_NAME_MAX_LENGTH}
                  autoComplete="off"
                  required
                  autoFocus
                />
                <span className="text-xs font-normal text-[var(--peace-muted)]">
                  Max {EVENT_LOCATION_NAME_MAX_LENGTH} caratteri
                </span>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[var(--peace-ink)]">
                Indirizzo
                <input
                  name="address"
                  defaultValue={location?.address ?? ""}
                  className="field font-normal"
                  maxLength={EVENT_LOCATION_ADDRESS_MAX_LENGTH}
                  autoComplete="street-address"
                />
                <span className="text-xs font-normal text-[var(--peace-muted)]">
                  Max {EVENT_LOCATION_ADDRESS_MAX_LENGTH} caratteri
                </span>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[var(--peace-ink)]">
                Capienza massima
                <input
                  name="maxCapacity"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  defaultValue={location?.maxCapacity ?? ""}
                  className="field font-normal"
                  required
                  aria-describedby="location-capacity-help"
                />
                <span id="location-capacity-help" className="text-xs font-normal leading-5 text-[var(--peace-muted)]">
                  Numero massimo di posti fisici. Deve essere un intero maggiore di zero.
                </span>
              </label>

              {publishedPanels.length > 0 ? (
                <div className="rounded-md border border-[#e5cf95] bg-[#fff9e9] px-4 py-3 text-sm leading-6 text-[#6f5414]">
                  <p className="font-semibold">Capienza collegata a panel pubblicati</p>
                  <p className="mt-1">
                    La capienza può essere salvata solo se resta coerente con le sezioni
                    dei panel pubblicati: {publishedPanels.map((panel) => panel.title).join(", ")}.
                  </p>
                </div>
              ) : null}

              {location ? <LocationPanelList panels={location.panels} /> : null}
            </div>
            <div className="flex flex-wrap justify-between gap-3 border-t border-[var(--peace-border)] px-5 py-4">
              <div>
                {location && location.panels.length === 0 ? (
                  <ConfirmSubmitButton
                    name="locationId"
                    value={location.id}
                    formAction={deleteEventLocation}
                    confirmMessage={`Eliminare definitivamente la location “${location.name}”?`}
                    className="min-h-11 rounded-md border border-[#d8a99c] px-4 text-sm font-semibold text-[#8a3323] transition hover:bg-[#fff3ef]"
                  >
                    Elimina
                  </ConfirmSubmitButton>
                ) : null}
              </div>
              <div className="flex flex-wrap justify-end gap-3">
                <Link
                  href={closePath}
                  scroll={false}
                  className="inline-flex min-h-11 items-center rounded-md border border-[var(--peace-border-strong)] px-4 text-sm font-semibold text-[var(--peace-ink)] transition hover:bg-[var(--peace-sky-100)]"
                >
                  Annulla
                </Link>
                <PendingSubmitButton className="min-h-11 rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--peace-blue-900)]">
                  {isEditing ? "Salva modifiche" : "Crea location"}
                </PendingSubmitButton>
              </div>
            </div>
          </form>
        ) : (
          <div className="grid gap-4 overflow-y-auto px-5 py-5 text-sm">
            <p>Questa location è disponibile in sola lettura.</p>
            <Link href={closePath} className="btn-secondary justify-self-end">Chiudi</Link>
          </div>
        )}
      </div>
    </div>
  );
}

function LocationStatus({ error, saved }: { error?: string; saved?: string }) {
  if (saved) {
    const messages: Record<string, string> = {
      created: "Location creata.",
      updated: "Location aggiornata.",
      deleted: "Location eliminata.",
    };

    return (
      <p className="mt-5 rounded-md border border-[#bbd7bd] bg-[#eef8ef] px-3 py-2 text-sm text-[#255532]">
        {messages[saved] ?? "Location aggiornata."}
      </p>
    );
  }

  if (!error) {
    return null;
  }

  const messages: Record<string, string> = {
    invalid: "Inserisci un nome valido e una capienza intera maggiore di zero.",
    "name-too-long": `Il nome non può superare ${EVENT_LOCATION_NAME_MAX_LENGTH} caratteri.`,
    "address-too-long": `L'indirizzo non può superare ${EVENT_LOCATION_ADDRESS_MAX_LENGTH} caratteri.`,
    forbidden: "Non hai permessi di modifica sulle location di questo evento.",
    "not-found": "La location non è stata trovata nell'evento corrente.",
    "location-in-use": "La location non può essere eliminata perché è associata a uno o più panel.",
    "published-capacity": "La nuova capienza non coincide con le sezioni di un panel pubblicato. Modifica prima le sezioni del panel.",
    conflict: "La modifica renderebbe incoerente un panel pubblicato e non è stata salvata.",
  };

  return (
    <p className="mt-5 rounded-md border border-[#e0b5a9] bg-[#fff3ef] px-3 py-2 text-sm text-[#8a3323]">
      {messages[error] ?? "Non è stato possibile completare l'operazione."}
    </p>
  );
}

function panelLocationsPath(
  dashboard: "admin" | "manager",
  navMode: "full" | "mini"
): string {
  return `/dashboard/${dashboard}?section=panel&panelView=locations&nav=${navMode}`;
}

function locationEditPath(
  dashboard: "admin" | "manager",
  navMode: "full" | "mini",
  locationId: string
): string {
  return `${panelLocationsPath(dashboard, navMode)}&locationId=${encodeURIComponent(locationId)}`;
}
