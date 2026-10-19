"use client";

import { EventAttendanceProvider, EventPresence, useEventAttendanceSettled } from "@/app/dashboard/event-attendance";
import { participantSortValue, sortOperationsParticipants } from "@/lib/registrations/operations-sort";
import { OperationalAssociationEditor } from "@/app/dashboard/operational-association-editor";
import { OperationalDemographicsEditor } from "@/app/dashboard/operational-demographics-editor";
import { useInternalSexColumn } from "./use-internal-sex-column";
import { ParticipantEmailCell } from "@/components/participant-email-cell";

import { attendanceTableColumns, attendanceSlotText } from "@/lib/registrations/attendance-summary";
import { MANUAL_REGISTRATION_COPY } from "@/lib/registrations/manual-registration-copy";
import { manualRegistrationPath } from "@/lib/registrations/manual-registration-navigation";
import type { SupportedLocale } from "@/lib/i18n/config";
import { ParticipantBirthDateField } from "@/components/participant-birth-date-field";
import { AccompanyingChildrenList } from "./accompanying-children-list";
import { OperationalAccessibilityEditor } from "@/app/dashboard/operational-accessibility-editor";

import { OperationalChildrenEditor } from "./operational-children-editor";

import { LocalQueryLink } from "@/components/local-query-link";
import { ParticipantSheetLoadingContext, useParticipantSheetPreparation, useParticipantSheetSection, type ParticipantSheetSection } from "./participant-sheet-loading";
import { OperationsParticipantQr } from "./operations-participant-qr";
import { OperationsAttendance } from "./operations-attendance";
import { PendingDownload } from "@/components/pending-download";
import { SuccessMessage } from "@/components/success-message";

import Link from "@/components/pending-link";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type ReactNode,
} from "react";
import { ArrowDown, ArrowUp, Columns3, Download, LoaderCircle, Pencil, UserPlus, X } from "lucide-react";
import { createOperationalTag } from "@/app/actions";
import { OperationsParticipantFilters } from "@/app/dashboard/operations-participant-filters";
import { OperationsParticipantsPagination } from "@/app/dashboard/operations-participants-pagination";
import { ReliableForm } from "@/components/reliable-form";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { applyOperationsDashboardFilters } from "@/lib/registrations/operations-dashboard";
import { parseStatisticsDrilldown } from "@/lib/registrations/event-statistics";
import { eventServiceStatusLabel } from "@/lib/registrations/event-services";
import {
  DEFAULT_TABLE_PREFERENCES,
  PARTICIPANT_COLUMNS,
  parseTablePreferences,
  paginateParticipants,
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
const ImportServicesDialog = dynamic(
  () => import("@/app/dashboard/participants/service-import/import-dialog"),
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
  attendancePanel,
  editableEventIds,
  dashboard,
  navMode,
  canDeleteRegistration,
  operatorId,
  eventId,
  eventStartsOn,
  eventEndsOn = null,
  dialogOnly = false,
  dataVersion = "",
  locale = "it",
}: {
  snapshot: OperationsParticipantsSnapshot;
  selectedParticipant: Row | null;
  attendancePanel?: ReactNode;
  editableEventIds: string[];
  dashboard: "admin" | "manager";
  navMode: "mini" | "full";
  canDeleteRegistration: boolean;
  operatorId: string;
  eventId: string | null;
  eventStartsOn: string | null;
  eventEndsOn?: string | null;
  dialogOnly?: boolean;
  dataVersion?: string;
  locale?: SupportedLocale;
}) {
  const canManage = Boolean(eventId && editableEventIds.includes(eventId));
  const attendanceColumns = attendanceTableColumns(eventStartsOn, eventEndsOn, locale);
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
  let preferences: TablePreferences = DEFAULT_TABLE_PREFERENCES;
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
  if (!canManage) preferences = { ...preferences, columns: preferences.columns.filter(column => column !== "sex"), sort: preferences.sort === "sex" ? "name" : preferences.sort };
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
  const sexText = useInternalSexColumn(canManage && view !== "deleted" && !(snapshot.statisticsFilter && parseStatisticsDrilldown(searchParams.get("stat"))?.personKind === "child") && columns.includes("sex"), snapshot.participants.filter(row => !row.deletedAt).map(row => row.registrationId), locale);
  const [changes, setChanges] = useState<
    Record<string, { original: Row; next: Row }>
  >({});
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [receptionBusy, setReceptionBusy] = useState(false);
  const [quickEditColumns, setQuickEditColumns] = useState({
    group: false,
    service: false,
  });
  const busy = useRef(new Set<string>());
  const tableRegion = useRef<HTMLDivElement>(null);
  const focusPage = useRef(false);
  const [pagePending, startPageTransition] = useTransition();
  const current = (row: Row) =>
    changes[row.registrationId]?.original === row
      ? changes[row.registrationId].next
      : row;
  const selectedId = searchParams.get("edit");
  const selectedRow = snapshot.allParticipants.find((row) => row.registrationId === selectedId)
    ?? (selectedParticipant?.registrationId === selectedId ? selectedParticipant : null);
  const selected = selectedRow ? current(selectedRow) : null;
  const canConfirmSelected = Boolean(selected && selected.eventId === eventId && editableEventIds.includes(selected.eventId) && !selected.deletedAt && selected.publicCode && ["submitted", "confirmed"].includes(selected.registrationStatus ?? ""));
  const paramsFor = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", "iscritti");
    params.delete("status");
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
    const nextPath = paramsFor({
        columns: normalized.columns.join(","),
        sort: normalized.sort,
        direction: normalized.direction,
        ...(normalized.sort !== preferences.sort || normalized.direction !== preferences.direction
          ? { participantPage: null } : {}),
      });
    if (snapshot.serverPage && (normalized.sort !== preferences.sort || normalized.direction !== preferences.direction ||
      (normalized.sort === "sex" && normalized.columns.includes("sex") !== preferences.columns.includes("sex")))) {
      startPageTransition(() => router.replace(nextPath, { scroll: false }));
    } else window.history.replaceState(null, "", nextPath);
  }
  function sortValue(
    row: Row,
    column: ParticipantColumn,
  ): string | number | null {
    return participantSortValue(row, column, eventStartsOn, locale, sexText);
  }
  const localRows = snapshot.participants.map(current);
  const rows = snapshot.serverPage ? applyOperationsDashboardFilters(localRows, snapshot.filters).filter(row => view !== "without-group" || !row.currentGroupId) : sortOperationsParticipants(
    applyOperationsDashboardFilters(localRows, snapshot.filters)
      .filter((row) => view !== "without-group" || !row.currentGroupId),
    preferences, eventStartsOn, locale, sexText,
  );
  const pagination = snapshot.serverPage ? { ...snapshot.serverPage, rows } : paginateParticipants(rows, searchParams.get("participantPage"));
  const registrationCount = snapshot.serverPage?.total ?? rows.length;
  const serverSort = snapshot.serverPage?.sort;
  const serverDirection = snapshot.serverPage?.direction;
  const serverSexColumn = snapshot.serverPage?.sexColumn;
  const preferenceColumns = preferences.columns.join(",");
  // Restore a saved sort on first entry even when it is not yet present in the URL.
  // The result must be sorted globally on the server, never just within this page.
  useEffect(() => {
    if (!serverSort || pagePending || (serverSort === preferences.sort && serverDirection === preferences.direction &&
      (serverSort !== "sex" || serverSexColumn === preferenceColumns.split(",").includes("sex")))) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("columns", preferenceColumns);
    params.set("sort", preferences.sort);
    params.set("direction", preferences.direction);
    startPageTransition(() => router.replace(`/dashboard/${dashboard}?${params}`, { scroll: false }));
  }, [serverSort, serverDirection, serverSexColumn, preferences.sort, preferences.direction, preferenceColumns, searchParams, router, dashboard, pagePending]);
  useEffect(() => {
    if (!focusPage.current || pagePending) return;
    focusPage.current = false;
    tableRegion.current?.focus({ preventScroll: true });
    tableRegion.current?.scrollIntoView({ block: "start" });
  }, [dataVersion, pagePending]);
  function changePage(page: number) {
    if (busy.current.size || receptionBusy || pagePending || page === pagination.page) return;
    const path = paramsFor({ participantPage: page > 1 ? String(page) : null, edit: null });
    if (snapshot.serverPage) {
      focusPage.current = true;
      startPageTransition(() => router.push(path, { scroll: false }));
      return;
    }
    window.history.pushState(null, "", path);
    // The same loaded result supplies every page; moving pages does not submit drafts.
    requestAnimationFrame(() => {
      tableRegion.current?.focus({ preventScroll: true });
      tableRegion.current?.scrollIntoView({ block: "start" });
    });
  }

  const statisticsKey = searchParams.get("stat");
  const isChildrenView = Boolean(
    snapshot.statisticsFilter &&
    parseStatisticsDrilldown(statisticsKey)?.personKind === "child",
  );
  const statisticsLabel = snapshot.statisticsFilter?.label;
  const accompanyingChildrenCount = snapshot.serverPage?.childrenCount ?? rows.reduce(
    (total, row) => total + row.childrenCount,
    0,
  );
  const registrationsLabel = isChildrenView
    ? registrationCount === 1 ? "iscrizione familiare" : "iscrizioni familiari"
    : registrationCount === 1 ? "iscrizione" : "iscrizioni";

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
        const nextRow = pagination.rows.find(
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

  const exportParams = new URLSearchParams(searchParams.toString());
  exportParams.set("kind", "export");
  exportParams.set("columns", columns.join(","));
  exportParams.delete("status");
  exportParams.delete("participantPage");
  return (
    <EventAttendanceProvider key={eventId} eventId={eventId}>
    {!dialogOnly && <section className="min-w-0 rounded-lg border border-[var(--peace-border)] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <h2 className="text-lg font-semibold">{view === "without-group" ? "Senza gruppo" : view === "deleted" ? "Iscrizioni eliminate" : "Gestione iscritti"}</h2>
            {canManage && (
              <div className="flex min-w-0 max-w-full flex-wrap gap-2">
                <Link id="manual-participant-trigger" className={buttonClass}
                  href={manualRegistrationPath(`/dashboard/${dashboard}?${searchParams}`, dashboard, true)}
                  prefetch={false} scroll={false}>
                  <UserPlus size={18} aria-hidden />{MANUAL_REGISTRATION_COPY[locale].addParticipant}
                </Link>
                <Link id="import-participants-trigger" className={buttonClass} href={paramsFor({ import: "excel", edit: null, manual: null, manualSaved: null, manualError: null })} prefetch={false} scroll={false}>
                  Importa iscritti da Excel
                </Link>
                <Link id="import-services-trigger" className={buttonClass} href={paramsFor({ import: "services", edit: null, manual: null, manualSaved: null, manualError: null })} prefetch={false} scroll={false}>
                  Importa servizi da Excel
                </Link>
              </div>
            )}
          </div>
          <p className="mt-1 text-sm text-[var(--peace-muted)]">
            {registrationCount} {registrationsLabel}
            {(accompanyingChildrenCount > 0 || isChildrenView) && (
              <> · {accompanyingChildrenCount} {accompanyingChildrenCount === 1 ? "figlio accompagnato" : "figli accompagnati"}</>
            )}
            {" "}· Apri la scheda dal nome del partecipante.
          </p>
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
      {canManage && searchParams.get("import") === "services" && (
        <ImportServicesDialog closePath={paramsFor({ import: null })} />
      )}
      {dashboard === "admin" && view !== "without-group" && (
        <div className="my-4">
          <Link className={buttonClass} prefetch={false}
            href={paramsFor({ view: view === "deleted" ? null : "deleted", edit: null, group: null, stat: null, participantPage: null })}>
            {view === "deleted" ? "Torna ai partecipanti" : "Iscrizioni eliminate"}
          </Link>
        </div>
      )}
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
      <OperationsParticipantFilters
        filters={snapshot.filters}
        groupOptions={snapshot.groupOptions}
        eventServices={snapshot.eventServices}
        operationalTags={snapshot.operationalTags}
        dashboard={dashboard}
        navMode={navMode}
        withoutGroup={view === "without-group"}
      />
      {statisticsLabel && (
        <p className="mb-4 rounded-md bg-[var(--peace-sky-100)] px-3 py-2 text-sm leading-6">
          Filtro dalle statistiche: {statisticsLabel}
        </p>
      )}

      <div className="relative mb-4 flex flex-wrap items-center gap-3">
        {view !== "without-group" && (
          <details className="rounded-md border border-[var(--peace-border-strong)] px-3 sm:relative">
            <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold">
              <Columns3 size={16} aria-hidden />
              Colonne visibili
            </summary>
            <fieldset
              aria-label="Colonne visibili"
              className="absolute left-0 z-30 mt-2 flex w-[min(24rem,calc(100vw-4rem))] sm:top-full flex-wrap gap-x-4 rounded-md border border-[var(--peace-border-strong)] bg-white p-3 shadow-lg"
            >
              {Object.entries(PARTICIPANT_COLUMNS).filter(([key]) => key !== "sex" || (canManage && view !== "deleted")).map(([key, label]) => (
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
        <PendingDownload
          filename="partecipanti.xlsx"
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-[#217346] bg-[#217346] px-3 text-sm font-semibold text-white hover:border-[#185c37] hover:bg-[#185c37] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#217346]"
          href={`/dashboard/participants/data-quality/api?${exportParams}`}
          aria-describedby="participants-export-description"
        >
          <Download size={18} aria-hidden />
          Esporta iscritti
        </PendingDownload>
        <p id="participants-export-description" className="min-w-0 flex-1 basis-60 text-sm text-[var(--peace-muted)]">
          Scarica un file Excel con gli iscritti filtrati, le colonne selezionate e sempre il numero e i nomi dei minori accompagnati.
        </p>
      </div>
      {notice ? <SuccessMessage key={notice} className="my-2 text-sm text-[var(--peace-blue-800)]">{notice}</SuccessMessage> : null}
      <OperationsParticipantsPagination {...pagination} position="inizio"
        disabled={Object.values(pending).some(Boolean) || receptionBusy || pagePending} onPageChange={changePage} />
      <div
        ref={tableRegion}
        className="scroll-mt-24 overflow-x-auto rounded-md border border-[var(--peace-border)]"
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
              {columns.map((column) => column === "attendance" ? attendanceColumns.map(slot => (
                <th key={slot.key} scope="col" className="whitespace-nowrap px-3 py-2 text-center font-semibold">{slot.label}</th>
              )) : (
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
            {pagination.rows.map((row) => (
              <tr
                key={row.registrationId}
                data-registration-id={row.registrationId}
                aria-busy={pending[row.registrationId] || false}
                className="border-t border-[var(--peace-border)] align-top hover:bg-[#f7fbfe]"
              >
                {columns.map((column) => column === "attendance" ? attendanceColumns.map(slot => (
                  <td key={slot.key} className="whitespace-nowrap px-3 py-3 text-center">{attendanceSlotText(row.attendance, slot, locale)}</td>
                )) : (
                  <td
                    key={column}
                    className={`px-3 py-3 ${column === "name" ? "sticky left-0 z-10 bg-white" : ""}`}
                  >
                    {column === "name" ? (
                      <div className="min-w-40 max-w-72">
                        <LocalQueryLink
                          id={`participant-${row.registrationId}`}
                          className="inline-flex min-h-11 items-center font-semibold text-[var(--peace-blue-800)] underline decoration-dotted underline-offset-4"
                          href={paramsFor({ edit: row.registrationId })}
                          scroll={false}
                        >
                          {row.name}
                        </LocalQueryLink>
                        <p className="text-xs text-[var(--peace-muted)]">
                          {row.publicCode ?? "Senza codice"}
                        </p>
                        <EventPresence inactive={Boolean(row.deletedAt) || !["submitted", "confirmed"].includes(row.registrationStatus ?? "")} eventId={row.eventId} registrationId={row.registrationId} />
                        <AccompanyingChildrenList records={row.children} participantName={row.name} startsOn={eventStartsOn} renderChildDetails={(child) => child.id ? <EventPresence inactive={Boolean(row.deletedAt) || !["submitted", "confirmed"].includes(row.registrationStatus ?? "")} eventId={row.eventId} registrationId={row.registrationId} childId={child.id} /> : null} />
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
                    ) : column === "email" ? (
                      <ParticipantEmailCell email={row.email} delegated={row.emailDelegated} locale={locale} />
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
      <OperationsParticipantsPagination {...pagination} position="fine"
        disabled={Object.values(pending).some(Boolean) || receptionBusy || pagePending} onPageChange={changePage} />
    </section>}
      {selected && (
        <ParticipantDialog key={selected.registrationId} participant={selected} closePath={closePath} busy={receptionBusy}
          editable={!selected.deletedAt && editableEventIds.includes(selected.eventId)} receptionEnabled={canConfirmSelected} hasAttendancePanel={attendancePanel != null}>
          {!selected.deletedAt && editableEventIds.includes(selected.eventId) ? (
            <OperationsParticipantQr key={`qr:${selected.registrationId}`} registrationId={selected.registrationId}
              participantName={selected.name} participantCode={selected.publicCode} locale={locale} eventId={selected.eventId} receptionEnabled={canConfirmSelected} onBusyChange={setReceptionBusy} />
          ) : null}
          {attendancePanel ?? (!selected.deletedAt && editableEventIds.includes(selected.eventId) ? (
            <OperationsAttendance key={`${selected.registrationId}:${dataVersion}`} registrationId={selected.registrationId} dashboard={dashboard} returnTo={returnTo} />
          ) : null)}
          {!canConfirmSelected && <section className="rounded-md border border-[var(--peace-border)] p-3"><h4 className="font-semibold">Partecipazione all’evento</h4><EventPresence inactive={Boolean(selected.deletedAt) || !["submitted", "confirmed"].includes(selected.registrationStatus ?? "")} eventId={selected.eventId} registrationId={selected.registrationId} /></section>}
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
            action="/dashboard/participants/update"
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
                <ParticipantBirthDateField key={`${selected.registrationId}:${selected.birthDate}`}
                  label="Data di nascita" locale="it" defaultValue={selected.birthDate ?? ""} />
                {(!editableEventIds.includes(selected.eventId) || selected.deletedAt) ? <Field label="Paese" name="country" value={selected.country} /> : null}
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
          {editableEventIds.includes(selected.eventId) && !selected.deletedAt ? <OperationalDemographicsEditor key={`demographics:${selected.registrationId}`} registrationId={selected.registrationId} locale={locale} /> : null}
          {editableEventIds.includes(selected.eventId) && !selected.deletedAt
            ? <OperationalAssociationEditor key={`association:${selected.registrationId}`} registrationId={selected.registrationId} />
            : <div className="grid gap-1 text-sm"><span className="font-semibold">Associazione / organizzazione</span><span>{selected.association || "—"}</span></div>}
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
          {editableEventIds.includes(selected.eventId) && !selected.deletedAt ? <OperationalAccessibilityEditor key={selected.registrationId} registrationId={selected.registrationId} /> : null}
          <section className="grid gap-2 text-sm">
            <h4 className="font-semibold">
              Figli partecipanti ({selected.childrenCount})
            </h4>
            <OperationalChildrenEditor registrationId={selected.registrationId} records={selected.children} renderChildDetails={(child) => child.id ? <EventPresence inactive={Boolean(selected.deletedAt) || !["submitted", "confirmed"].includes(selected.registrationStatus ?? "")} eventId={selected.eventId} registrationId={selected.registrationId} childId={child.id} /> : null} editable={editableEventIds.includes(selected.eventId) && !selected.deletedAt} />
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
    </EventAttendanceProvider>
  );
}

type ParticipantDialogProps = {
  participant: Row; closePath: string; children: ReactNode; busy?: boolean;
  editable: boolean; receptionEnabled: boolean; hasAttendancePanel: boolean;
};

function ParticipantDialog(props: ParticipantDialogProps) {
  const [attempt, setAttempt] = useState(0);
  return <PreparedParticipantDialog key={attempt} {...props} onRetry={() => setAttempt(value => value + 1)} />;
}

function ParticipantSheetPresence() {
  useParticipantSheetSection("presence", useEventAttendanceSettled());
  return null;
}

function PreparedParticipantDialog({
  participant,
  closePath,
  children,
  busy = false,
  editable, receptionEnabled, hasAttendancePanel, onRetry,
}: ParticipantDialogProps & { onRetry: () => void }) {
  const required: ParticipantSheetSection[] = editable
    ? ["qr", "demographics", "association", "accessibility", ...(hasAttendancePanel ? [] : ["attendance" as const]), ...(receptionEnabled ? ["reception" as const] : [])]
    : [];
  const needsPresence = !participant.deletedAt && ["submitted", "confirmed"].includes(participant.registrationStatus ?? "")
    && (!receptionEnabled || participant.children.some(child => Boolean(child.id)));
  if (needsPresence) required.push("presence");
  const { ready, expired, complete } = useParticipantSheetPreparation(required);
  const locked = ready && busy;
  const ref = useRef<HTMLDialogElement>(null);
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
      aria-busy={!ready}
      className="fixed inset-0 m-auto h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-hidden open:flex open:flex-col rounded-lg bg-white p-0 text-[var(--peace-ink)] shadow-xl backdrop:bg-black/40"
      onCancel={(event) => {
        event.preventDefault();
        if (!locked) window.history.replaceState(null, "", closePath);
      }}
    >
      <div className="flex shrink-0 items-start justify-between gap-3 border-b p-5">
        <div>
          <h3 id="participant-dialog-title" className="text-xl font-semibold">
            Scheda partecipante
          </h3>
          <p>{participant.name}</p>
        </div>
        {locked ? <button type="button" className={buttonClass} disabled aria-label="Chiudi scheda partecipante"><X size={18} /></button> : <LocalQueryLink
          replace
          href={closePath}
          scroll={false}
          className={buttonClass}
          aria-label="Chiudi scheda partecipante"
        >
          <X size={18} />
        </LocalQueryLink>}
      </div>
      {!ready ? <div className="grid min-h-0 flex-1 place-content-center justify-items-center gap-3 p-5 text-center">
        {expired ? <>
          <p role="alert">Il caricamento della scheda non è stato completato. Riprova.</p>
          <button type="button" className={buttonClass} onClick={onRetry}>Riprova caricamento</button>
        </> : <p role="status" className="flex items-center gap-2"><LoaderCircle className="size-5 animate-spin" aria-hidden="true" />Caricamento scheda partecipante…</p>}
      </div> : null}
      <ParticipantSheetLoadingContext.Provider value={complete}>
        {needsPresence ? <ParticipantSheetPresence /> : null}
        <div hidden={!ready} inert={!ready} className={ready ? "grid min-h-0 flex-1 content-start gap-6 overflow-y-auto p-5" : "hidden"}>
          {children}
        </div>
      </ParticipantSheetLoadingContext.Provider>
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
