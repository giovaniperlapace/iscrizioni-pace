"use client";

import Link from "next/link";
import { CalendarCheck, Pencil, Send, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { publishPanels } from "@/app/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  panelCapacityDifference,
  type PanelDraftRow,
} from "@/lib/panels/panel-drafts";

type PanelPublicationTableProps = {
  panels: PanelDraftRow[];
  totalCount: number;
  dashboard: "admin" | "manager";
  navMode: "full" | "mini";
  eventId: string;
  panelPath: string;
  canManage: boolean;
};

export function PanelPublicationTable({
  panels,
  totalCount,
  dashboard,
  navMode,
  eventId,
  panelPath,
  canManage,
}: PanelPublicationTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dialogIds, setDialogIds] = useState<string[] | null>(null);
  const headerCheckbox = useRef<HTMLInputElement>(null);
  const draftIds = useMemo(
    () => panels.filter((panel) => panel.publicationStatus === "draft").map((panel) => panel.id),
    [panels]
  );
  const selectedDraftIds = draftIds.filter((id) => selectedIds.has(id));
  const allDraftsSelected =
    draftIds.length > 0 && selectedDraftIds.length === draftIds.length;

  useEffect(() => {
    if (headerCheckbox.current) {
      headerCheckbox.current.indeterminate =
        selectedDraftIds.length > 0 && !allDraftsSelected;
    }
  }, [allDraftsSelected, selectedDraftIds.length]);

  if (panels.length === 0) {
    return (
      <p className="mt-5 rounded-md border border-dashed border-[var(--peace-border-strong)] px-4 py-6 text-center text-sm text-[var(--peace-muted)]">
        {totalCount === 0
          ? "Nessun panel configurato per l'evento corrente."
          : "Nessun panel corrisponde ai filtri."}
      </p>
    );
  }

  const dialogPanels = (dialogIds ?? [])
    .map((id) => panels.find((panel) => panel.id === id))
    .filter((panel): panel is PanelDraftRow => Boolean(panel));

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[var(--peace-muted)]" aria-live="polite">
          {panels.length} panel
          {canManage && selectedDraftIds.length > 0
            ? ` · ${selectedDraftIds.length} selezionati`
            : ""}
        </p>
        {canManage && draftIds.length > 0 ? (
          <button
            type="button"
            disabled={selectedDraftIds.length === 0}
            onClick={() => setDialogIds(selectedDraftIds)}
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[var(--peace-blue-800)] px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="size-4" aria-hidden="true" />
            Pubblica selezionati
          </button>
        ) : null}
      </div>

      <div className="mt-3 grid gap-3 md:hidden">
        {panels.map((panel) => (
          <article key={panel.id} className="rounded-md border border-[var(--peace-border)] p-4">
            <div className="flex items-start gap-3">
              {canManage && panel.publicationStatus === "draft" ? (
                <input
                  type="checkbox"
                  checked={selectedIds.has(panel.id)}
                  onChange={() => togglePanel(panel.id)}
                  className="mt-1 size-5 accent-[var(--peace-blue-800)]"
                  aria-label={`Seleziona ${panel.title}`}
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{panel.title}</h3>
                    <p className="mt-1 text-sm text-[var(--peace-muted)]">
                      {formatSchedule(panel)}
                    </p>
                  </div>
                  <PublicationBadge panel={panel} />
                </div>
                <p className="mt-3 text-sm">
                  {panel.locationName ?? "Location da definire"}
                </p>
                <CapacitySummary panel={panel} />
                <div className="mt-3 flex flex-wrap gap-2">
                  <PanelEditLink
                    panel={panel}
                    panelPath={panelPath}
                    canManage={canManage}
                  />
                  {canManage && panel.publicationStatus === "draft" ? (
                    <button
                      type="button"
                      onClick={() => setDialogIds([panel.id])}
                      className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--peace-border-strong)] px-3 font-semibold text-[var(--peace-blue-800)]"
                    >
                      <Send className="size-4" aria-hidden="true" />
                      Pubblica
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-3 hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1080px] table-fixed border-collapse text-left text-sm">
          <colgroup>
            {canManage ? <col className="w-[5%]" /> : null}
            <col className="w-[22%]" />
            <col className="w-[17%]" />
            <col className="w-[15%]" />
            <col className="w-[16%]" />
            <col className="w-[13%]" />
            <col className="w-[12%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-[var(--peace-border)] text-xs uppercase tracking-wide text-[#6f7f91]">
              {canManage ? (
                <th className="py-3 pr-3 font-semibold">
                  <input
                    ref={headerCheckbox}
                    type="checkbox"
                    checked={allDraftsSelected}
                    disabled={draftIds.length === 0}
                    onChange={() => toggleAllDrafts()}
                    className="size-5 accent-[var(--peace-blue-800)]"
                    aria-label="Seleziona tutte le bozze filtrate"
                  />
                </th>
              ) : null}
              <th className="py-3 pr-4 font-semibold">Panel</th>
              <th className="py-3 pr-4 font-semibold">Orario</th>
              <th className="py-3 pr-4 font-semibold">Location</th>
              <th className="py-3 pr-4 font-semibold">Posti</th>
              <th className="py-3 pr-4 font-semibold">Stato</th>
              <th className="py-3 pl-4 text-right font-semibold">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {panels.map((panel) => (
              <tr key={panel.id} className="border-b border-[var(--peace-border)] align-top last:border-b-0">
                {canManage ? (
                  <td className="py-4 pr-3">
                    {panel.publicationStatus === "draft" ? (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(panel.id)}
                        onChange={() => togglePanel(panel.id)}
                        className="size-5 accent-[var(--peace-blue-800)]"
                        aria-label={`Seleziona ${panel.title}`}
                      />
                    ) : null}
                  </td>
                ) : null}
                <td className="py-4 pr-4 font-semibold">{panel.title}</td>
                <td className="py-4 pr-4 text-[var(--peace-muted)]">{formatSchedule(panel)}</td>
                <td className="py-4 pr-4">{panel.locationName ?? "Da definire"}</td>
                <td className="py-4 pr-4"><CapacitySummary panel={panel} compact /></td>
                <td className="py-4 pr-4"><PublicationBadge panel={panel} /></td>
                <td className="py-4 pl-4 text-right">
                  <div className="flex justify-end gap-2">
                    <PanelEditLink panel={panel} panelPath={panelPath} canManage={canManage} />
                    {canManage && panel.publicationStatus === "draft" ? (
                      <button
                        type="button"
                        onClick={() => setDialogIds([panel.id])}
                        className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--peace-border-strong)] px-3 font-semibold text-[var(--peace-blue-800)]"
                      >
                        <Send className="size-4" aria-hidden="true" />
                        Pubblica
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dialogIds && dialogPanels.length > 0 ? (
        <div className="dashboard-modal fixed inset-0 z-50 grid place-items-center bg-black/35 px-4 py-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="publish-panel-dialog-title"
            className="grid max-h-[90vh] w-full max-w-xl overflow-hidden rounded-lg bg-white shadow-xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--peace-border)] px-5 py-4">
              <div>
                <h3 id="publish-panel-dialog-title" className="text-xl font-semibold">
                  Pubblica {dialogPanels.length === 1 ? "il panel" : `${dialogPanels.length} panel`}
                </h3>
                <p className="mt-1 text-sm text-[var(--peace-muted)]">
                  La pubblicazione è atomica: se un panel non è valido, nessuno viene pubblicato.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDialogIds(null)}
                className="inline-flex size-10 items-center justify-center rounded-md border border-[var(--peace-border-strong)] text-[var(--peace-blue-800)]"
                aria-label="Chiudi conferma pubblicazione"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-5">
              <ul className="grid gap-2">
                {dialogPanels.map((panel) => (
                  <li key={panel.id} className="flex gap-3 rounded-md bg-[#f7fbfe] px-3 py-2">
                    <CalendarCheck className="mt-0.5 size-4 shrink-0 text-[var(--peace-blue-800)]" aria-hidden="true" />
                    <span>
                      <strong>{panel.title}</strong>
                      <span className="block text-sm text-[var(--peace-muted)]">{formatSchedule(panel)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <form action={publishPanels} className="flex flex-wrap justify-end gap-3 border-t border-[var(--peace-border)] px-5 py-4">
              <input type="hidden" name="sourceDashboard" value={dashboard} />
              <input type="hidden" name="nav" value={navMode} />
              <input type="hidden" name="eventId" value={eventId} />
              {dialogPanels.map((panel) => (
                <input key={panel.id} type="hidden" name="panelIds" value={panel.id} />
              ))}
              <button type="button" onClick={() => setDialogIds(null)} className="btn-secondary">
                Annulla
              </button>
              <PendingSubmitButton className="min-h-11 rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white">
                Conferma pubblicazione
              </PendingSubmitButton>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );

  function togglePanel(panelId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(panelId)) next.delete(panelId);
      else next.add(panelId);
      return next;
    });
  }

  function toggleAllDrafts() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allDraftsSelected) draftIds.forEach((id) => next.delete(id));
      else draftIds.forEach((id) => next.add(id));
      return next;
    });
  }
}

function PanelEditLink({ panel, panelPath, canManage }: { panel: PanelDraftRow; panelPath: string; canManage: boolean }) {
  return (
    <Link
      href={`${panelPath}&panelId=${encodeURIComponent(panel.id)}`}
      scroll={false}
      className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--peace-border-strong)] px-3 font-semibold text-[var(--peace-blue-800)]"
    >
      <Pencil className="size-4" aria-hidden="true" />
      {canManage ? "Modifica" : "Consulta"}
    </Link>
  );
}

function CapacitySummary({ panel, compact = false }: { panel: PanelDraftRow; compact?: boolean }) {
  const difference = panelCapacityDifference(panel.assignedCapacity, panel.locationCapacity);
  return (
    <p className={compact ? "tabular-nums" : "mt-2 text-sm tabular-nums text-[var(--peace-muted)]"}>
      {panel.assignedCapacity} / {panel.locationCapacity ?? "—"} posti
      {difference === 0 ? <span className="ml-2 font-semibold text-[#255532]">Completa</span> : difference !== null ? <span className={`ml-2 font-semibold ${difference > 0 ? "text-[#536579]" : "text-[#8a5d16]"}`}>{difference > 0 ? `${difference} non assegnati` : `${Math.abs(difference)} in eccesso`}</span> : null}
    </p>
  );
}

function PublicationBadge({ panel }: { panel: PanelDraftRow }) {
  if (panel.publicationStatus === "published") {
    return (
      <span className="grid gap-1">
        <span className="w-fit rounded-full bg-[#e7f4e9] px-2.5 py-1 text-xs font-bold text-[#255532]">Pubblicato</span>
        <span className="text-xs text-[var(--peace-muted)]">{formatPublicationDate(panel.publishedAt)}</span>
      </span>
    );
  }
  return <span className="rounded-full bg-[#eef3f7] px-2.5 py-1 text-xs font-bold text-[#536579]">Bozza</span>;
}

function formatSchedule(panel: PanelDraftRow): string {
  if (!panel.startsAt || !panel.endsAt) return "Orario da definire";
  const formatter = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  return `${formatter.format(new Date(panel.startsAt))} – ${formatter.format(new Date(panel.endsAt))}`;
}

function formatPublicationDate(value: string | null): string {
  if (!value) return "Data non disponibile";
  return new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}
