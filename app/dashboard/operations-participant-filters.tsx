"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WorkStatus } from "@/components/work-status";
import { parseOperationsDashboardFilters, type OperationsDashboardFilters } from "@/lib/registrations/operations-dashboard";
import type { OperationsParticipantsSnapshot } from "@/lib/registrations/operations-types";

const EMPTY_FILTERS = parseOperationsDashboardFilters({});
const FILTER_NAMES = ["q", "contact", "group", "service", "tag"] as const;
const OVERLAY_PARAMS = ["edit", "editMode", "groupId", "groupLinkGroupId", "groupLinkToken", "groupTool"];
const buttonClass = "inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--peace-border-strong)] bg-white px-3 text-sm font-semibold text-[var(--peace-blue-800)] hover:bg-[var(--peace-sky-100)] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50";

export function OperationsParticipantFilters({
  filters, groupOptions, eventServices, operationalTags, dashboard, navMode, withoutGroup,
}: Pick<OperationsParticipantsSnapshot, "filters" | "groupOptions" | "eventServices" | "operationalTags"> & {
  dashboard: "admin" | "manager";
  navMode: "mini" | "full";
  withoutGroup: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState(filters);
  const filterKey = JSON.stringify(filters);
  const [appliedKey, setAppliedKey] = useState(filterKey);
  const [submittedKey, setSubmittedKey] = useState<string | null>(null);

  if (filterKey !== appliedKey) {
    setAppliedKey(filterKey);
    // Our response must not overwrite edits made while the request was in flight.
    // Navigation to other filters (including browser history) still restores them.
    if (filterKey !== submittedKey) setDraft(filters);
    setSubmittedKey(null);
  }

  function applyFilters(values: OperationsDashboardFilters, reset = false) {
    if (isPending) return;
    const normalized = parseOperationsDashboardFilters(values);
    const params = new URLSearchParams(searchParams.toString());
    for (const key of OVERLAY_PARAMS) params.delete(key);
    params.delete("status");
    if (reset) params.delete("stat");
    params.set("section", "iscritti");
    params.set("nav", navMode);
    for (const name of FILTER_NAMES) {
      if (normalized[name] === EMPTY_FILTERS[name]) params.delete(name);
      else params.set(name, normalized[name]);
    }
    setSubmittedKey(JSON.stringify(normalized));
    startTransition(() => {
      if (params.toString() === searchParams.toString()) router.refresh();
      else router.replace(`/dashboard/${dashboard}?${params}`, { scroll: false });
    });
  }

  return (
    <form action={`/dashboard/${dashboard}`} method="get" className="mb-4"
      aria-label="Ricerca iscritti" aria-busy={isPending}
      onSubmit={(event) => {
        event.preventDefault();
        applyFilters(draft);
      }}>
      <input type="hidden" name="section" value="iscritti" />
      <input type="hidden" name="nav" value={navMode} />
      <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <label className="grid gap-1 text-sm">
          Partecipante, codice o provenienza
          <input
            name="q"
            className="field"
            value={draft.q}
            onChange={(event) => setDraft({ ...draft, q: event.target.value })}
            placeholder="Cerca iscritti"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Email o telefono
          <input
            name="contact"
            className="field"
            value={draft.contact}
            onChange={(event) => setDraft({ ...draft, contact: event.target.value })}
            placeholder="Cerca contatti"
          />
        </label>
        {!withoutGroup && (
          <label className="grid min-w-0 gap-1 text-sm sm:col-span-2 xl:col-span-1">
            Gruppo
            <select
              name="group"
              className="field"
              value={draft.group}
              onChange={(event) => setDraft({ ...draft, group: event.target.value })}
            >
              <option value="all">Tutti i gruppi</option>
              <option value="none">Senza gruppo</option>
              {groupOptions.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="grid min-w-0 gap-1 text-sm sm:col-start-1">
          Servizio
          <select
            name="service"
            className="field"
            value={draft.service}
            onChange={(event) => setDraft({ ...draft, service: event.target.value })}
          >
            <option value="all">Tutti i servizi</option>
            <option value="none">Senza servizio</option>
            {eventServices.map((service) => (
              <option key={service.id} value={service.id}>
                {service.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-sm">
          Tag
          <select
            name="tag"
            className="field"
            value={draft.tag}
            onChange={(event) => setDraft({ ...draft, tag: event.target.value })}
          >
            <option value="all">Tutti i tag</option>
            <option value="none">Senza tag</option>
            {operationalTags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap items-start gap-2 sm:col-span-2 xl:col-span-1">
          <button type="submit" className={buttonClass} disabled={isPending}>
            Cerca
          </button>
          <button type="button" className={buttonClass} disabled={isPending}
            onClick={() => {
              setDraft(EMPTY_FILTERS);
              applyFilters(EMPTY_FILTERS, true);
            }}>
            Azzera filtri
          </button>
        </div>
      </div>
      <p className="mt-2 text-sm text-[var(--peace-muted)]">Premi Invio o Cerca per applicare i filtri.</p>
      {isPending ? <WorkStatus className="mt-2 text-sm text-[var(--peace-blue-800)]" /> : null}
    </form>
  );
}
