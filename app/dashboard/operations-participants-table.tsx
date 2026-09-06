"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { ArrowDown, ArrowUp, Columns3, Download, Pencil, X } from "lucide-react";
import { createOperationalTag } from "@/app/actions";
import { AutoFilterForm } from "@/app/dashboard/auto-filter-form";
import { ReliableForm } from "@/components/reliable-form";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { applyOperationsDashboardFilters } from "@/lib/registrations/operations-dashboard";
import { parseStatisticsDrilldown } from "@/lib/registrations/event-statistics";
import { calculateAgeAtDate } from "@/lib/groups/matching";
import { eventServiceStatusLabel } from "@/lib/registrations/event-services";
import {
  DEFAULT_TABLE_PREFERENCES,
  PARTICIPANT_COLUMNS,
  parseTablePreferences,
  type ParticipantColumn,
  type TablePreferences,
} from "@/lib/registrations/operations-table";
import type {
  OperationsParticipantRow as Row,
  OperationsParticipantsSnapshot,
} from "@/lib/registrations/operations-types";

const ImportParticipantsDialog = dynamic(
  () => import("@/app/dashboard/participants/data-quality/import-dialog"),
);

const buttonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[var(--peace-border-strong)] bg-white px-3 text-sm font-semibold text-[var(--peace-blue-800)] hover:bg-[var(--peace-sky-100)] focus-visible:outline-2 focus-visible:outline-offset-2";
const subscribe = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener("participant-preferences", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("participant-preferences", callback);
  };
};
const serverPreferences = () => "";

export function OperationsParticipantsTable({
  snapshot,
  selectedParticipant,
  editableEventIds,
  dashboard,
  navMode,
  canDeleteRegistration,
  operatorId,
  eventId,
  eventStartsOn,
}: {
  snapshot: OperationsParticipantsSnapshot;
  selectedParticipant: Row | null;
  editableEventIds: string[];
  dashboard: "admin" | "manager";
  navMode: "mini" | "full";
  canDeleteRegistration: boolean;
  operatorId: string;
  eventId: string | null;
  eventStartsOn: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storageKey = `iscrizioni:participants:v2:${operatorId}`;
  const stored = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(storageKey) ?? "";
      } catch {
        return "";
      }
    },
    serverPreferences,
  );
  let preferences = DEFAULT_TABLE_PREFERENCES;
  try {
    preferences = parseTablePreferences(JSON.parse(stored));
  } catch {
    /* Defaults when storage is unavailable. */
  }
  preferences = parseTablePreferences({
    columns: searchParams.has("columns")
      ? searchParams.get("columns")!.split(",")
      : preferences.columns,
    sort: searchParams.get("sort") ?? preferences.sort,
    direction: searchParams.get("direction") ?? preferences.direction,
  });
  const view =
    searchParams.get("view") === "deleted" && dashboard === "admin"
      ? "deleted"
      : searchParams.get("view") === "without-group"
        ? "without-group"
        : "all";
  const columns: ParticipantColumn[] =
    view === "without-group"
      ? ["name", "country", "city", "age", "group"]
      : preferences.columns;
  const [changes, setChanges] = useState<
    Record<string, { original: Row; next: Row }>
  >({});
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [quickEditColumns, setQuickEditColumns] = useState({
    group: false,
    service: false,
  });
  const busy = useRef(new Set<string>());
  const current = (row: Row) =>
    changes[row.registrationId]?.original === row
      ? changes[row.registrationId].next
      : row;
  const selected = selectedParticipant ? current(selectedParticipant) : null;
  const paramsFor = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", "iscritti");
    params.set("nav", navMode);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    return `/dashboard/${dashboard}?${params}`;
  };
  const closePath = paramsFor({ edit: null });
  const returnTo = paramsFor({});
  function savePreferences(next: TablePreferences) {
    const normalized = parseTablePreferences(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(normalized));
      window.dispatchEvent(new Event("participant-preferences"));
    } catch {
      /* URL still preserves state. */
    }
    window.history.replaceState(
      null,
      "",
      paramsFor({
        columns: normalized.columns.join(","),
        sort: normalized.sort,
        direction: normalized.direction,
      }),
    );
  }
  function sortValue(
    row: Row,
    column: ParticipantColumn,
  ): string | number | null {
    switch (column) {
      case "age":
        return calculateAgeAtDate(row.birthDate, eventStartsOn);
      case "group":
        return row.currentGroupName;
      case "service":
        return row.service?.serviceLabel ?? null;
      case "tags":
        return row.tags
          .map((tag) => tag.label)
          .sort()
          .join(", ");
      default:
        return row[column];
    }
  }
  const rows = applyOperationsDashboardFilters(
    snapshot.participants.map(current),
    snapshot.filters,
  )
    .filter((row) => view !== "without-group" || !row.currentGroupId)
    .sort((a, b) => {
      const av = sortValue(a, preferences.sort),
        bv = sortValue(b, preferences.sort);
      if (av === null || bv === null)
        return av === bv
          ? a.registrationId.localeCompare(b.registrationId)
          : av === null
            ? 1
            : -1;
      const comparison =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), "it", {
              numeric: true,
              sensitivity: "base",
            });
      return (
        (preferences.direction === "asc" ? comparison : -comparison) ||
        a.registrationId.localeCompare(b.registrationId)
      );
    });

  const statisticsKey = searchParams.get("stat");
  const isChildrenView = Boolean(
    snapshot.statisticsFilter &&
    parseStatisticsDrilldown(statisticsKey)?.personKind === "child",
  );
  const [childrenDisplay, setChildrenDisplay] = useState({
    statisticsKey,
    visible: isChildrenView,
  });
  // A new statistics selection restores its default without resetting on sorting.
  if (childrenDisplay.statisticsKey !== statisticsKey) {
    setChildrenDisplay({ statisticsKey, visible: isChildrenView });
  }
  const showChildren = childrenDisplay.statisticsKey === statisticsKey
    ? childrenDisplay.visible
    : isChildrenView;
  const statisticsLabel = isChildrenView
    ? snapshot.statisticsFilter?.label.replace(/^Minori accompagnati(?: · )?/, "")
    : snapshot.statisticsFilter?.label;
  const accompanyingChildrenCount = rows.reduce(
    (total, row) => total + row.childrenCount,
    0,
  );
  const registrationsLabel = isChildrenView
    ? rows.length === 1 ? "iscrizione familiare" : "iscrizioni familiari"
    : rows.length === 1 ? "iscrizione" : "iscrizioni";

  async function quickUpdate(
    row: Row,
    field: "group" | "service" | "tags",
    values: string[],
  ) {
    if (busy.current.has(row.registrationId)) return;
    busy.current.add(row.registrationId);
    setNotice("");
    setPending((prev) => ({ ...prev, [row.registrationId]: true }));
    setErrors((prev) => ({ ...prev, [row.registrationId]: "" }));
    const data = new FormData();
    data.set("registrationId", row.registrationId);
    data.set("participantId", row.participantId);
    data.set("sourceDashboard", dashboard);
    data.set("field", field);
    values.forEach((value) => data.append("value", value));
    try {
      const response = await fetch("/dashboard/participants/quick-update", {
        method: "POST",
        body: data,
      });
      const result = await response.json();
      if (!response.ok || !result.ok)
        throw new Error(result.error ?? "Salvataggio non riuscito. Riprova.");
      const next = { ...row };
      if (field === "group") {
        next.currentGroupId = values[0] || null;
        next.currentGroupName =
          snapshot.groupOptions.find((group) => group.id === values[0])?.name ??
          null;
        next.currentGroupStatus = values[0] ? "confirmed" : null;
      } else if (field === "service") {
        const service = snapshot.eventServices.find(
          (service) => service.id === values[0],
        );
        next.currentServiceId = service?.id ?? null;
        next.currentServiceStatus = service ? "assigned" : null;
        next.service = service
          ? {
              id: row.service?.id ?? "",
              eventId: row.eventId,
              registrationId: row.registrationId,
              participantId: row.participantId,
              serviceId: service.id,
              serviceLabel: service.label,
              status: "assigned",
              source: "manager",
              participantNote: row.service?.participantNote ?? null,
              operatorNote: row.service?.operatorNote ?? null,
              updatedAt: null,
            }
          : null;
      } else {
        next.tagIds = values;
        next.tags = snapshot.operationalTags
          .filter((tag) => values.includes(tag.id))
          .map((tag) => ({ ...tag, assignedAt: null }));
      }
      setChanges((prev) => ({
        ...prev,
        [row.registrationId]: {
          original:
            snapshot.allParticipants.find(
              (item) => item.registrationId === row.registrationId,
            ) ?? row,
          next,
        },
      }));
      setNotice(
        `${row.name}: ${field === "group" ? "gruppo aggiornato" : field === "service" ? "servizio aggiornato" : "tag aggiornati"}.${view === "without-group" && field === "group" && values[0] ? " Rimosso dalla coda Senza gruppo." : ""}`,
      );
      if (
        view === "without-group" &&
        field === "group" &&
        values[0] &&
        !selected
      ) {
        const nextRow = rows.find(
          (item) => item.registrationId !== row.registrationId,
        );
        requestAnimationFrame(() => {
          const target = nextRow
            ? document.getElementById(`participant-${nextRow.registrationId}`)
            : document.querySelector<HTMLElement>(
                '[aria-label="Tabella iscritti, scorrimento orizzontale"]',
              );
          target?.focus({ preventScroll: true });
        });
      }
      router.refresh();
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        [row.registrationId]:
          error instanceof Error
            ? error.message
            : "Salvataggio non riuscito. Riprova.",
      }));
    } finally {
      busy.current.delete(row.registrationId);
      setPending((prev) => ({ ...prev, [row.registrationId]: false }));
    }
  }

  function operationsControl(
    row: Row,
    field: "group" | "service" | "tags",
    editingEnabled = true,
  ) {
    const canEdit =
      editingEnabled && editableEventIds.includes(row.eventId) && !row.deletedAt;
    const disabled = pending[row.registrationId];
    if (field === "tags")
      return canEdit ? (
        <details className="min-w-40 rounded-md border border-[var(--peace-border-strong)] bg-white px-3">
          <summary
            className="min-h-11 cursor-pointer py-3 text-sm"
            aria-label={`Tag di ${row.name}`}
          >
            {row.tags.map((tag) => tag.label).join(", ") || "Senza tag"}
          </summary>
          <fieldset
            disabled={disabled}
            aria-label={`Tag operativi di ${row.name}`}
            className="grid max-h-60 gap-1 overflow-y-auto pb-2"
          >
            {snapshot.operationalTags
              .filter((tag) => tag.eventId === row.eventId)
              .map((tag) => (
                <label
                  key={tag.id}
                  className="flex min-h-11 items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={row.tagIds.includes(tag.id)}
                    onChange={(event) =>
                      void quickUpdate(
                        row,
                        "tags",
                        event.target.checked
                          ? [...row.tagIds, tag.id]
                          : row.tagIds.filter((id) => id !== tag.id),
                      )
                    }
                  />
                  <span
                    aria-hidden
                    className="size-2 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.label}
                </label>
              ))}
            {!snapshot.operationalTags.some(
              (tag) => tag.eventId === row.eventId,
            ) && <p className="text-sm">Nessun tag disponibile.</p>}
          </fieldset>
        </details>
      ) : (
        <span>
          {row.tags.map((tag) => tag.label).join(", ") || "Senza tag"}
        </span>
      );
    const value = field === "group" ? row.currentGroupId : row.currentServiceId;
    const options =
      field === "group"
        ? snapshot.groupOptions
            .filter((group) => group.eventId === row.eventId)
            .map((group) => ({ id: group.id, label: group.name }))
        : snapshot.eventServices
            .filter(
              (service) => service.eventId === row.eventId && service.isActive,
            )
            .map((service) => ({ id: service.id, label: service.label }));
    const currentLabel =
      field === "group" ? row.currentGroupName : row.service?.serviceLabel;
    const emptyLabel = field === "group" ? "Senza gruppo" : "Senza servizio";
    if (!canEdit)
      return (
        <div className="grid gap-1">
          <span>{currentLabel ?? emptyLabel}</span>
          {field === "service" && row.service && (
            <span className="text-xs text-[var(--peace-muted)]">
              {eventServiceStatusLabel(row.service.status)}
            </span>
          )}
        </div>
      );
    return (
      <div className="grid min-w-44 gap-1">
        <select
          className="field min-h-11 bg-white text-sm"
          aria-label={`${field === "group" ? "Gruppo" : "Servizio"} di ${row.name}`}
          disabled={disabled}
          value={value ?? ""}
          onChange={(event) =>
            void quickUpdate(row, field, [event.target.value])
          }
        >
          <option value="">{emptyLabel}</option>
          {value && !options.some((option) => option.id === value) && (
            <option value={value} disabled>
              {currentLabel} (non disponibile)
            </option>
          )}
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        {field === "service" && row.service && (
          <span className="text-xs text-[var(--peace-muted)]">
            {eventServiceStatusLabel(row.service.status)}
          </span>
        )}
        {field === "service" &&
          row.service &&
          row.service.status !== "assigned" &&
          options.some((option) => option.id === value) && (
            <button
              type="button"
              disabled={disabled}
              className="min-h-11 text-left text-sm font-semibold text-[var(--peace-blue-800)] underline"
              onClick={() => void quickUpdate(row, "service", [value!])}
            >
              Assegna questo servizio
            </button>
          )}
      </div>
    );
  }

  const canManage = Boolean(eventId && editableEventIds.includes(eventId));
  return (
    <section className="min-w-0 rounded-lg border border-[var(--peace-border)] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Gestione iscritti</h2>
          <p className="mt-1 text-sm text-[var(--peace-muted)]">
            {rows.length} {registrationsLabel}
            {(accompanyingChildrenCount > 0 || isChildrenView) && (
              <> · {accompanyingChildrenCount} {accompanyingChildrenCount === 1 ? "figlio accompagnato" : "figli accompagnati"}</>
            )}
            {" "}· Apri la scheda dal nome del partecipante.
          </p>
          {canManage && <div className="mt-3 flex flex-wrap gap-3">
            <Link id="import-participants-trigger" className={buttonClass} href={paramsFor({ import: "excel", edit: null })} scroll={false}>
              Importa iscritti da Excel
            </Link>
          </div>}
        </div>
        {canManage && eventId && view !== "deleted" && (
          <details>
            <summary className={`${buttonClass} cursor-pointer`}>
              Crea tag operativo
            </summary>
            <ReliableForm
              action={createOperationalTag}
              autoComplete="off"
              className="mt-2 grid gap-2 rounded-md border p-3"
            >
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="sourceDashboard" value={dashboard} />
              <input type="hidden" name="nav" value={navMode} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <label className="grid gap-1 text-sm">
                Nome tag
                <input
                  className="field"
                  name="operationalTagLabel"
                  maxLength={40}
                  required
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                Colore
                <input type="color" name="color" defaultValue="#0f5f8f" />
              </label>
              <PendingSubmitButton className={buttonClass}>
                Crea
              </PendingSubmitButton>
            </ReliableForm>
          </details>
        )}
      </div>
      {canManage && searchParams.get("import") === "excel" && (
        <ImportParticipantsDialog closePath={paramsFor({ import: null })} />
      )}
      <nav aria-label="Viste iscritti" className="my-4 flex flex-wrap gap-2">
        {[
          ["all", "Tutti gli iscritti"],
          ["without-group", "Senza gruppo"],
          ...(dashboard === "admin"
            ? [["deleted", "Iscrizioni eliminate"]]
            : []),
        ].map(([key, label]) => (
          <Link
            prefetch={false}
            key={key}
            href={paramsFor({
              view: key === "all" ? null : key,
              edit: null,
              group: null,
              stat: null,
            })}
            scroll={false}
            aria-current={view === key ? "page" : undefined}
            className={`${buttonClass} ${view === key ? "!bg-[var(--peace-blue-800)] !text-white" : ""}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {view === "without-group" && (
        <p className="mb-4 text-sm">
          Attiva la modifica rapida nella colonna Gruppo e assegna un gruppo
          dal selettore: la persona uscirà subito da questa coda.
        </p>
      )}
      {view === "deleted" && (
        <p className="mb-4 text-sm">
          Iscrizioni escluse dalle attività. Apri la scheda per consultare la
          motivazione e ripristinarle.
        </p>
      )}
      <AutoFilterForm
        action={`/dashboard/${dashboard}`}
        debounceMs={900}
        blockWhilePending={false}
        defaults={{ group: "all", service: "all", tag: "all", status: "all" }}
      >
        <input type="hidden" name="section" value="iscritti" />
        <input type="hidden" name="nav" value={navMode} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <label className="grid gap-1 text-sm">
            Partecipante, codice o provenienza
            <input
              key={snapshot.filters.q}
              name="q"
              className="field"
              defaultValue={snapshot.filters.q}
              placeholder="Cerca iscritti"
            />
          </label>
          <label className="grid gap-1 text-sm">
            Email o telefono
            <input
              key={snapshot.filters.contact}
              name="contact"
              className="field"
              defaultValue={snapshot.filters.contact}
              placeholder="Cerca contatti"
            />
          </label>
          {view !== "without-group" && (
            <label className="grid gap-1 text-sm">
              Gruppo
              <select
                name="group"
                className="field"
                defaultValue={snapshot.filters.group}
                key={snapshot.filters.group}
              >
                <option value="all">Tutti i gruppi</option>
                <option value="none">Senza gruppo</option>
                {snapshot.groupOptions.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="grid gap-1 text-sm">
            Servizio
            <select
              name="service"
              className="field"
              defaultValue={snapshot.filters.service}
            >
              <option value="all">Tutti i servizi</option>
              <option value="none">Senza servizio</option>
              {snapshot.eventServices.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Tag
            <select
              name="tag"
              className="field"
              defaultValue={snapshot.filters.tag}
            >
              <option value="all">Tutti i tag</option>
              <option value="none">Senza tag</option>
              {snapshot.operationalTags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Stato
            <select
              name="status"
              className="field"
              defaultValue={snapshot.filters.status}
            >
              <option value="all">Tutti gli stati</option>
              <option value="submitted">Inviata</option>
              <option value="confirmed">Confermata</option>
              <option value="cancelled">Annullata</option>
            </select>
          </label>
        </div>
      </AutoFilterForm>
      <div className="my-4 flex flex-wrap items-start gap-3">
        {view !== "without-group" && (
          <details className="rounded-md border border-[var(--peace-border-strong)] px-3">
            <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold">
              <Columns3 size={16} aria-hidden />
              Colonne visibili
            </summary>
            <fieldset
              aria-label="Colonne visibili"
              className="flex max-w-xl flex-wrap gap-x-4 pb-3"
            >
              {Object.entries(PARTICIPANT_COLUMNS).map(([key, label]) => (
                <label
                  key={key}
                  className="flex min-h-11 items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={preferences.columns.includes(
                      key as ParticipantColumn,
                    )}
                    disabled={key === "name"}
                    onChange={(event) =>
                      savePreferences({
                        ...preferences,
                        columns: event.target.checked
                          ? [...preferences.columns, key as ParticipantColumn]
                          : preferences.columns.filter(
                              (column) => column !== key,
                            ),
                      })
                    }
                  />
                  {label}
                </label>
              ))}
            </fieldset>
          </details>
        )}
        <button
          type="button"
          aria-pressed={showChildren}
          className={`${buttonClass} ${showChildren ? "!bg-[var(--peace-blue-800)] !text-white" : ""}`}
          onClick={() => setChildrenDisplay({ statisticsKey, visible: !showChildren })}
        >
          Mostra figli accompagnati
        </button>
        <Link
          prefetch={false}
          className={buttonClass}
          href={paramsFor({
            q: null,
            contact: null,
            group: null,
            service: null,
            tag: null,
            status: null,
            stat: null,
            edit: null,
          })}
          scroll={false}
        >
          Azzera filtri
        </Link>
        {statisticsLabel && (
          <p className="min-w-0 flex-1 basis-72 rounded-md bg-[var(--peace-sky-100)] px-3 py-2 text-sm leading-6">
            Filtro dalle statistiche: {statisticsLabel}
          </p>
        )}
      </div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <a
          download
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-md border border-[#217346] bg-[#217346] px-3 text-sm font-semibold text-white hover:border-[#185c37] hover:bg-[#185c37] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#217346]"
          href={`/dashboard/participants/data-quality/api?${new URLSearchParams({ ...Object.fromEntries(searchParams), kind: "export" })}`}
          aria-describedby="participants-export-description"
        >
          <Download size={18} aria-hidden />
          Esporta iscritti
        </a>
        <p id="participants-export-description" className="text-sm text-[var(--peace-muted)]">
          Scarica un file Excel con gli iscritti che corrispondono ai filtri attualmente applicati.
        </p>
      </div>
      <p
        role="status"
        aria-live="polite"
        className="my-2 text-sm text-[var(--peace-blue-800)]"
      >
        {notice}
      </p>
      <div
        className="overflow-x-auto rounded-md border border-[var(--peace-border)]"
        role="region"
        aria-label="Tabella iscritti, scorrimento orizzontale"
        tabIndex={0}
      >
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">
            {view === "without-group"
              ? "Iscritti senza gruppo"
              : view === "deleted"
                ? "Iscrizioni eliminate"
                : "Iscritti"}
          </caption>
          <thead className="bg-[var(--peace-sky-100)]">
            <tr>
              {columns.map((column) => (
                <th
                  key={column}
                  scope="col"
                  aria-sort={
                    preferences.sort === column
                      ? preferences.direction === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                  className={`px-3 py-2 ${column === "name" ? "sticky left-0 z-10 bg-[var(--peace-sky-100)]" : ""}`}
                >
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="flex min-h-11 items-center gap-2 whitespace-nowrap font-semibold"
                      onClick={() =>
                        savePreferences({
                          ...preferences,
                          sort: column,
                          direction:
                            preferences.sort === column &&
                            preferences.direction === "asc"
                              ? "desc"
                              : "asc",
                        })
                      }
                    >
                      {PARTICIPANT_COLUMNS[column]}
                      {preferences.sort === column &&
                        (preferences.direction === "asc" ? (
                          <ArrowUp size={14} aria-hidden />
                        ) : (
                          <ArrowDown size={14} aria-hidden />
                        ))}
                    </button>
                    {canManage &&
                      view !== "deleted" &&
                      (column === "group" || column === "service") && (
                        <button
                          type="button"
                          role="switch"
                          aria-label={`Modifica rapida ${PARTICIPANT_COLUMNS[column]}`}
                          aria-checked={quickEditColumns[column]}
                          title={`${quickEditColumns[column] ? "Disattiva" : "Attiva"} modifica rapida ${PARTICIPANT_COLUMNS[column]}`}
                          onClick={() =>
                            setQuickEditColumns((previous) => ({
                              ...previous,
                              [column]: !previous[column],
                            }))
                          }
                          className={`inline-flex size-11 shrink-0 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 ${quickEditColumns[column] ? "bg-[var(--peace-blue-800)] text-white hover:bg-[var(--peace-blue-900)]" : "text-[var(--peace-blue-800)] hover:bg-white"}`}
                        >
                          <Pencil size={16} aria-hidden />
                        </button>
                      )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.registrationId}
                data-registration-id={row.registrationId}
                aria-busy={pending[row.registrationId] || false}
                className="border-t border-[var(--peace-border)] align-top hover:bg-[#f7fbfe]"
              >
                {columns.map((column) => (
                  <td
                    key={column}
                    className={`px-3 py-3 ${column === "name" ? "sticky left-0 z-10 bg-white" : ""}`}
                  >
                    {column === "name" ? (
                      <div className="min-w-40 max-w-72">
                        <Link
                          prefetch={false}
                          id={`participant-${row.registrationId}`}
                          className="inline-flex min-h-11 items-center font-semibold text-[var(--peace-blue-800)] underline decoration-dotted underline-offset-4"
                          href={paramsFor({ edit: row.registrationId })}
                          scroll={false}
                        >
                          {row.name}
                        </Link>
                        <p className="text-xs text-[var(--peace-muted)]">
                          {row.publicCode ?? "Senza codice"}
                        </p>
                        {showChildren && row.childrenCount > 0 && (
                          <div className="mt-2">
                            <span className="inline-flex rounded-md bg-[var(--peace-sky-100)] px-2 py-1 text-xs font-semibold text-[var(--peace-blue-800)]">
                              {row.childrenCount} {row.childrenCount === 1 ? "figlio accompagnato" : "figli accompagnati"}
                            </span>
                            <ul
                              aria-label={`Figli accompagnati di ${row.name}`}
                              className="mt-2 grid gap-1 border-l-2 border-[var(--peace-border-strong)] pl-2 text-xs leading-5 text-[var(--peace-muted)]"
                            >
                              {row.children.map((child) => {
                                const age = calculateAgeAtDate(child.birth_date, eventStartsOn);
                                return (
                                  <li key={child.id} className="break-words">
                                    <span className="font-medium text-[var(--peace-ink)]">{child.first_name} {child.last_name}</span>
                                    {" · "}
                                    <span title="Età all’inizio dell’evento">
                                      {age === null ? "Età non disponibile" : age === 0 ? "meno di 1 anno" : `${age} ${age === 1 ? "anno" : "anni"}`}
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}
                        {pending[row.registrationId] && (
                          <p role="status">Salvataggio…</p>
                        )}
                        {errors[row.registrationId] && (
                          <p role="alert" className="mt-2 text-red-700">
                            {errors[row.registrationId]}
                          </p>
                        )}
                      </div>
                    ) : column === "group" ||
                      column === "service" ||
                      column === "tags" ? (
                      operationsControl(
                        row,
                        column,
                        column === "tags" || quickEditColumns[column],
                      )
                    ) : column === "submittedAt" ? (
                      formatDate(row.submittedAt)
                    ) : (
                      (sortValue(row, column) ?? "—")
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="p-5 text-sm">
            {view === "without-group"
              ? "Nessuna iscrizione senza gruppo corrisponde ai filtri."
              : "Nessuna iscrizione corrisponde ai filtri correnti."}
          </p>
        )}
      </div>
      {selected && (
        <ParticipantDialog participant={selected} closePath={closePath}>
          {selected.deletedAt ? (
            <div className="grid gap-2 rounded-md bg-red-50 p-4 text-sm">
              <p>Eliminata il {formatDate(selected.deletedAt)}.</p>
              <p>Motivazione: {selected.deletionReason}</p>
              <p>
                Autore:{" "}
                {selected.deletedByName ?? "Operatore non più disponibile"}
              </p>
              <p>Identità, account, consensi e storico sono conservati.</p>
            </div>
          ) : null}
          <ReliableForm
            action="/dashboard/admin/participants/update"
            method="post"
            data-preserve-dashboard-scroll
            className="grid gap-3"
          >
            <FormContext
              participant={selected}
              dashboard={dashboard}
              navMode={navMode}
              returnTo={returnTo}
            />
            <fieldset
              disabled={
                !editableEventIds.includes(selected.eventId) ||
                Boolean(selected.deletedAt)
              }
              className="grid gap-3"
            >
              <legend className="mb-2 font-semibold">
                Identità e contatti
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Nome"
                  name="firstName"
                  value={selected.firstName}
                  required
                />
                <Field
                  label="Cognome"
                  name="lastName"
                  value={selected.lastName}
                  required
                />
                <Field
                  label="Data di nascita"
                  name="birthDate"
                  type="date"
                  value={selected.birthDate}
                />
                <Field label="Paese" name="country" value={selected.country} />
                <Field label="Città" name="city" value={selected.city} />
                <Field
                  label="Email"
                  name="email"
                  type="email"
                  value={selected.email}
                />
                <Field label="Telefono" name="phone" value={selected.phone} />
              </div>
              {editableEventIds.includes(selected.eventId) &&
                !selected.deletedAt && (
                  <PendingSubmitButton className={`${buttonClass} w-fit`}>
                    Salva dati
                  </PendingSubmitButton>
                )}
            </fieldset>
          </ReliableForm>
          <section className="grid gap-3">
            <h4 className="font-semibold">Gruppo, servizio e tag</h4>
            {(["group", "service", "tags"] as const).map((field) => (
              <div key={field} className="grid gap-1">
                <span className="text-sm font-semibold">
                  {PARTICIPANT_COLUMNS[field]}
                </span>
                {operationsControl(selected, field)}
              </div>
            ))}
            {pending[selected.registrationId] && (
              <p role="status">Salvataggio…</p>
            )}
            {errors[selected.registrationId] && (
              <p role="alert" className="text-sm text-red-700">
                {errors[selected.registrationId]}
              </p>
            )}
          </section>
          <section className="grid gap-2 text-sm">
            <h4 className="font-semibold">
              Figli partecipanti ({selected.childrenCount})
            </h4>
            {selected.children.map((child) => (
              <p key={child.id}>
                {child.first_name} {child.last_name} ·{" "}
                {formatDate(child.birth_date)}
              </p>
            ))}
            {!selected.childrenCount && <p>Nessun figlio associato.</p>}
          </section>
          {(selected.deletedAt
            ? dashboard === "admin"
            : canDeleteRegistration &&
              editableEventIds.includes(selected.eventId)) && (
            <ReliableForm
              action="/dashboard/participants/delete"
              method="post"
              data-preserve-dashboard-scroll
              className="grid gap-3 border-t pt-4"
            >
              <FormContext
                participant={selected}
                dashboard={dashboard}
                navMode={navMode}
                returnTo={closePath}
              />
              <input
                type="hidden"
                name="intent"
                value={selected.deletedAt ? "restore" : "delete"}
              />
              <p className="text-sm">
                {selected.deletedAt
                  ? "Il ripristino riattiva l’iscrizione con i dati conservati. Le campagne già escluse non vengono riavviate."
                  : "L’eliminazione esclude l’iscrizione dalle attività e sospende il QR. Account e storico restano conservati; un admin può ripristinarla."}
              </p>
              <label className="grid gap-1 text-sm font-semibold">
                {selected.deletedAt
                  ? "Motivazione del ripristino"
                  : "Motivazione dell’eliminazione"}
                <textarea
                  name="reason"
                  required
                  minLength={3}
                  maxLength={500}
                  className="field min-h-20 font-normal"
                />
              </label>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" name="confirmLifecycle" required />
                Confermo{" "}
                {selected.deletedAt
                  ? "il ripristino"
                  : "l’eliminazione"} di {selected.name}
              </label>
              <PendingSubmitButton
                className={`${buttonClass} w-fit ${selected.deletedAt ? "" : "!border-red-300 !text-red-700"}`}
              >
                {selected.deletedAt
                  ? "Ripristina iscrizione"
                  : "Elimina iscrizione"}
              </PendingSubmitButton>
            </ReliableForm>
          )}
        </ParticipantDialog>
      )}
    </section>
  );
}

function ParticipantDialog({
  participant,
  closePath,
  children,
}: {
  participant: Row;
  closePath: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      document
        .getElementById(`participant-${participant.registrationId}`)
        ?.focus({ preventScroll: true });
    };
  }, [participant.registrationId]);
  return (
    <dialog
      ref={ref}
      aria-labelledby="participant-dialog-title"
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-hidden rounded-lg bg-white p-0 text-[var(--peace-ink)] shadow-xl backdrop:bg-black/40"
      onCancel={(event) => {
        event.preventDefault();
        router.replace(closePath, { scroll: false });
      }}
    >
      <div className="flex items-start justify-between gap-3 border-b p-5">
        <div>
          <h3 id="participant-dialog-title" className="text-xl font-semibold">
            Scheda partecipante
          </h3>
          <p>{participant.name}</p>
        </div>
        <Link
          prefetch={false}
          href={closePath}
          scroll={false}
          className={buttonClass}
          aria-label="Chiudi scheda partecipante"
        >
          <X size={18} />
        </Link>
      </div>
      <div className="grid max-h-[calc(90dvh-7rem)] gap-6 overflow-y-auto p-5">
        {children}
      </div>
    </dialog>
  );
}
function FormContext({
  participant,
  dashboard,
  navMode,
  returnTo,
}: {
  participant: Row;
  dashboard: string;
  navMode: string;
  returnTo: string;
}) {
  return (
    <>
      <input
        type="hidden"
        name="registrationId"
        value={participant.registrationId}
      />
      <input
        type="hidden"
        name="participantId"
        value={participant.participantId}
      />
      <input type="hidden" name="sourceDashboard" value={dashboard} />
      <input type="hidden" name="nav" value={navMode} />
      <input type="hidden" name="returnTo" value={returnTo} />
    </>
  );
}
function Field({
  label,
  name,
  value,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  value: string | null;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1 text-sm">
      {label}
      <input
        className="field"
        type={type}
        name={name}
        defaultValue={value ?? ""}
        required={required}
      />
    </label>
  );
}
function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("it", {
        dateStyle: "medium",
        timeZone: "Europe/Rome",
      }).format(new Date(value))
    : "—";
}
