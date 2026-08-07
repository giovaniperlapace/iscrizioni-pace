"use client";

import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { usePanelDraftFormState } from "@/app/dashboard/panel-draft-form-state";
import type { EventLocationOption } from "@/lib/panels/event-locations";
import {
  PANEL_DESCRIPTION_MAX_LENGTH,
  PANEL_MAX_SECTIONS,
  PANEL_TITLE_MAX_LENGTH,
  findPanelScheduleConflict,
  parsePanelLocalDateTime,
  type PanelAudienceTypeOption,
  type PanelDraftRow,
} from "@/lib/panels/panel-drafts";

type EditableSection = {
  key: string;
  audienceTypeId: string;
  capacity: string;
};

type PanelDraftFieldsProps = {
  panel: PanelDraftRow | null;
  locations: EventLocationOption[];
  audienceTypes: PanelAudienceTypeOption[];
  startsAt: string;
  endsAt: string;
  eventStartsOn: string;
  eventEndsOn: string;
  conflictPanels: Array<{
    id: string;
    title: string;
    locationId: string | null;
    startsAt: string | null;
    endsAt: string | null;
  }>;
};

export function PanelDraftFields({
  panel,
  locations,
  audienceTypes,
  startsAt: initialStartsAt,
  endsAt: initialEndsAt,
  eventStartsOn,
  eventEndsOn,
  conflictPanels,
}: PanelDraftFieldsProps) {
  const { setCapacityExceeded } = usePanelDraftFormState();
  const [locationId, setLocationId] = useState(panel?.locationId ?? "");
  const [startsAt, setStartsAt] = useState(initialStartsAt);
  const [endsAt, setEndsAt] = useState(initialEndsAt);
  const [sections, setSections] = useState<EditableSection[]>(() =>
    (panel?.sections ?? []).map((section) => ({
      key: section.id,
      audienceTypeId: section.audienceTypeId,
      capacity: String(section.capacity),
    }))
  );
  const activeLocations = locations.filter(
    (location) => location.isActive && location.maxCapacity !== null
  );
  const selectedLocation = locations.find((location) => location.id === locationId);
  const locationCapacity = selectedLocation?.maxCapacity ?? null;
  const assignedCapacity = sections.reduce((total, section) => {
    const value = Number(section.capacity);
    return total + (Number.isInteger(value) && value >= 0 ? value : 0);
  }, 0);
  const difference =
    locationCapacity === null ? null : locationCapacity - assignedCapacity;
  const capacityExceeded = difference !== null && difference < 0;
  const duplicateAudience = sections.some(
    (section, index) =>
      section.audienceTypeId &&
      sections.findIndex(
        (candidate) => candidate.audienceTypeId === section.audienceTypeId
      ) !== index
  );
  const conflictingPanel = useMemo(() => {
    return findPanelScheduleConflict(
      {
        panelId: panel?.id,
        locationId,
        startsAtLocal: startsAt,
        endsAtLocal: endsAt,
      },
      conflictPanels
    );
  }, [conflictPanels, endsAt, locationId, panel?.id, startsAt]);

  useEffect(() => {
    setCapacityExceeded(capacityExceeded);
  }, [capacityExceeded, setCapacityExceeded]);

  return (
    <div className="grid gap-5">
      <label className="grid gap-2 text-sm font-semibold text-[var(--peace-ink)]">
        Titolo
        <input
          name="title"
          defaultValue={panel?.title ?? ""}
          className="field font-normal"
          maxLength={PANEL_TITLE_MAX_LENGTH}
          autoComplete="off"
          required
          autoFocus
        />
        <span className="text-xs font-normal text-[var(--peace-muted)]">
          Max {PANEL_TITLE_MAX_LENGTH} caratteri
        </span>
      </label>

      <label className="grid gap-2 text-sm font-semibold text-[var(--peace-ink)]">
        Descrizione
        <textarea
          name="description"
          defaultValue={panel?.description ?? ""}
          className="field min-h-28 resize-y font-normal"
          maxLength={PANEL_DESCRIPTION_MAX_LENGTH}
        />
        <span className="text-xs font-normal text-[var(--peace-muted)]">
          Max {PANEL_DESCRIPTION_MAX_LENGTH} caratteri
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-[var(--peace-ink)]">
          Inizio
          <input
            type="datetime-local"
            value={startsAt}
            min={`${eventStartsOn}T00:00`}
            max={`${eventEndsOn}T23:59`}
            onChange={(event) => setStartsAt(event.target.value)}
            className="field font-normal"
            required
          />
          <input type="hidden" name="startsAt" value={toIsoString(startsAt)} />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-[var(--peace-ink)]">
          Fine
          <input
            type="datetime-local"
            value={endsAt}
            min={`${eventStartsOn}T00:00`}
            max={`${eventEndsOn}T23:59`}
            onChange={(event) => setEndsAt(event.target.value)}
            className="field font-normal"
            required
          />
          <input type="hidden" name="endsAt" value={toIsoString(endsAt)} />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-semibold text-[var(--peace-ink)]">
        Location
        <select
          name="locationId"
          value={locationId}
          onChange={(event) => setLocationId(event.target.value)}
          className="field font-normal"
          required
        >
          <option value="">Seleziona una location</option>
          {activeLocations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name} · {location.maxCapacity} posti
            </option>
          ))}
        </select>
      </label>

      {conflictingPanel ? (
        <p
          role="alert"
          className="flex gap-2 rounded-md border border-[#e0b5a9] bg-[#fff3ef] px-3 py-2 text-sm text-[#8a3323]"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          L&apos;orario si sovrappone al panel “{conflictingPanel.title}” nella stessa
          location. Modifica orario o location prima di salvare.
        </p>
      ) : null}

      <fieldset className="grid gap-3 rounded-md border border-[var(--peace-border)] p-4">
        <legend className="px-1 font-semibold">Sezioni di posti</legend>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs leading-5 text-[var(--peace-muted)]">
              Ogni tipo di pubblico può comparire una sola volta. La somma dei
              posti può essere inferiore alla capienza della location, ma non può
              superarla.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setSections((current) => [
                ...current,
                { key: crypto.randomUUID(), audienceTypeId: "", capacity: "0" },
              ])
            }
            disabled={sections.length >= PANEL_MAX_SECTIONS}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--peace-border-strong)] px-3 text-sm font-semibold text-[var(--peace-blue-800)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="size-4" aria-hidden="true" />
            Aggiungi sezione
          </button>
        </div>

        {sections.length === 0 ? (
          <p className="rounded-md border border-dashed border-[var(--peace-border-strong)] px-3 py-4 text-sm text-[var(--peace-muted)]">
            Nessuna sezione ancora configurata.
          </p>
        ) : (
          <div className="grid gap-3">
            {sections.map((section, index) => (
              <div
                key={section.key}
                className="grid gap-3 rounded-md bg-[#f7fbfe] p-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-end"
              >
                <label className="grid gap-1 text-sm font-semibold">
                  Tipo pubblico {index + 1}
                  <select
                    name="audienceTypeIds"
                    value={section.audienceTypeId}
                    onChange={(event) =>
                      updateSection(section.key, { audienceTypeId: event.target.value })
                    }
                    className="field font-normal"
                    required
                  >
                    <option value="">Seleziona</option>
                    {audienceTypes
                      .filter(
                        (audience) =>
                          audience.isActive || audience.id === section.audienceTypeId
                      )
                      .map((audience) => (
                        <option key={audience.id} value={audience.id}>
                          {audience.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold">
                  Posti
                  <input
                    name="sectionCapacities"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    value={section.capacity}
                    onChange={(event) =>
                      updateSection(section.key, { capacity: event.target.value })
                    }
                    className="field font-normal tabular-nums"
                    required
                  />
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setSections((current) =>
                      current.filter((candidate) => candidate.key !== section.key)
                    )
                  }
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#d8a99c] px-3 text-sm font-semibold text-[#8a3323]"
                  aria-label={`Rimuovi sezione ${index + 1}`}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  <span className="sm:sr-only">Rimuovi</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {duplicateAudience ? (
          <p role="alert" className="text-sm font-semibold text-[#8a3323]">
            Lo stesso tipo di pubblico è stato selezionato più di una volta.
          </p>
        ) : null}

        <div
          className="grid gap-2 rounded-md border border-[var(--peace-border-strong)] bg-white px-4 py-3 sm:grid-cols-3"
          aria-live="polite"
        >
          <CapacityMetric label="Assegnati" value={assignedCapacity} />
          <CapacityMetric label="Capienza" value={locationCapacity} />
          <CapacityMetric
            label={difference !== null && difference < 0 ? "Eccedenza" : "Differenza"}
            value={difference === null ? null : Math.abs(difference)}
            tone={difference === null ? "neutral" : difference < 0 ? "warning" : "valid"}
          />
        </div>

        {difference !== null ? (
          <p className="text-sm text-[var(--peace-muted)]">
            {difference === 0
              ? "La distribuzione coincide con la capienza e il panel può essere salvato."
              : difference > 0
                ? `Restano ${difference} ${difference === 1 ? "posto non distribuito" : "posti non distribuiti"}. Il panel può essere salvato.`
                : `La distribuzione supera la capienza di ${Math.abs(difference)} ${Math.abs(difference) === 1 ? "posto" : "posti"}. Il panel non potrà essere salvato.`}
          </p>
        ) : null}
      </fieldset>
    </div>
  );

  function updateSection(key: string, patch: Partial<EditableSection>) {
    setSections((current) =>
      current.map((section) =>
        section.key === key ? { ...section, ...patch } : section
      )
    );
  }
}

function CapacityMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number | null;
  tone?: "neutral" | "valid" | "warning";
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--peace-muted)]">
        {label}
      </p>
      <p
        className={[
          "mt-1 text-xl font-bold tabular-nums",
          tone === "valid"
            ? "text-[#255532]"
            : tone === "warning"
              ? "text-[#8a5d16]"
              : "text-[var(--peace-ink)]",
        ].join(" ")}
      >
        {value ?? "—"}
      </p>
    </div>
  );
}

function toIsoString(value: string): string {
  return parsePanelLocalDateTime(value)?.toISOString() ?? "";
}
