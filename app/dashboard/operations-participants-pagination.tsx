"use client";

import { useId } from "react";
import { PARTICIPANTS_PAGE_SIZE } from "@/lib/registrations/operations-table";

const buttonClass = "inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--peace-border-strong)] bg-white px-3 text-sm font-semibold text-[var(--peace-blue-800)] hover:bg-[var(--peace-sky-100)] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50";

export function OperationsParticipantsPagination({
  page, pageCount, first, last, total, disabled, onPageChange, position,
}: {
  page: number;
  pageCount: number;
  first: number;
  last: number;
  total: number;
  disabled: boolean;
  onPageChange: (page: number) => void;
  position: "inizio" | "fine";
}) {
  const selectId = useId();
  return (
    <nav aria-label={`Pagine iscritti, ${position} elenco`} className="my-3 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-[var(--peace-muted)]" aria-live={position === "inizio" ? "polite" : undefined} aria-atomic="true">
        {first}–{last} di {total} iscrizioni · {PARTICIPANTS_PAGE_SIZE} per pagina
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={buttonClass} disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)}>
          Precedente
        </button>
        <div className="flex items-center gap-2">
          <label htmlFor={selectId} className="sr-only text-sm sm:not-sr-only">Pagina</label>
          <select id={selectId} className="min-h-11 min-w-14 rounded-md border border-[var(--peace-border-strong)] bg-white px-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
            value={page} disabled={disabled || pageCount === 1}
            onChange={(event) => onPageChange(Number(event.target.value))}>
            {Array.from({ length: pageCount }, (_, index) => (
              <option key={index + 1} value={index + 1}>{index + 1}</option>
            ))}
          </select>
          <span className="text-sm">di {pageCount}</span>
        </div>
        <button type="button" className={buttonClass} disabled={disabled || page >= pageCount} onClick={() => onPageChange(page + 1)}>
          Successiva
        </button>
      </div>
    </nav>
  );
}
