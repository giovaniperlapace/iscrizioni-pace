"use client";

import Link from "@/components/pending-link";
import { useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { ArrowDown, ArrowUp, Columns3, Download } from "lucide-react";
import {
  PARTICIPANT_COLUMNS,
  parseTablePreferences,
  type ParticipantColumn,
  type TablePreferences,
} from "@/lib/registrations/operations-table";
import {
  leaderCellText,
  leaderPreferences,
  leaderReturnPath,
  sortLeaderRows,
  type LeaderTableRow,
} from "@/lib/groups/leader-table";
import { LEADER_TABLE_COPY } from "@/lib/groups/leader-table-copy";
import type { SupportedLocale } from "@/lib/i18n/config";

const buttonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[var(--peace-border-strong)] bg-white px-3 text-sm font-semibold text-[var(--peace-blue-800)] hover:bg-[var(--peace-sky-100)] focus-visible:outline-2 focus-visible:outline-offset-2";
const subscribe = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener("leader-preferences", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("leader-preferences", callback);
  };
};
const serverPreferences = () => "";
export function LeaderParticipantsTable({
  rows,
  operatorId,
  startsOn,
  locale,
}: {
  rows: LeaderTableRow[];
  operatorId: string;
  startsOn: string | null;
  locale: SupportedLocale;
}) {
  const searchParams = useSearchParams();
  const copy = LEADER_TABLE_COPY[locale];
  const storageKey = `iscrizioni:leader-participants:v1:${operatorId}`;
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
  let decoded: unknown;
  try {
    decoded = JSON.parse(stored);
  } catch {
    /* Use defaults. */
  }
  const preferences = leaderPreferences(
    new URLSearchParams(searchParams.toString()),
    decoded,
  );
  const sorted = sortLeaderRows(rows, preferences, startsOn, locale);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const tablePath = (updates: Record<string, string | null> = {}) =>
    leaderReturnPath(`/dashboard/capogruppo?${searchParams}`, {
      columns: preferences.columns.join(","),
      sort: preferences.sort,
      direction: preferences.direction,
      ...updates,
    });
  function savePreferences(next: TablePreferences) {
    const normalized = parseTablePreferences(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(normalized));
      window.dispatchEvent(new Event("leader-preferences"));
    } catch {
      /* URL preserves state. */
    }
    window.history.replaceState(
      null,
      "",
      tablePath({
        columns: normalized.columns.join(","),
        sort: normalized.sort,
        direction: normalized.direction,
      }),
    );
  }
  async function download() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const params = new URL(tablePath(), window.location.origin).searchParams;
      const response = await fetch(`/dashboard/capogruppo/export?${params}`);
      if (
        !response.ok ||
        !response.headers.get("content-type")?.includes("spreadsheetml")
      )
        throw new Error();
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "partecipanti-gruppo.xlsx";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError(copy.error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="mt-4 flex flex-wrap items-start gap-3">
        <details className="relative">
          <summary className={`${buttonClass} cursor-pointer list-none`}>
            <Columns3 size={16} aria-hidden="true" />
            {copy.visibleColumns}
          </summary>
          <fieldset
            aria-label={copy.visibleColumns}
            className="absolute left-0 top-full z-20 mt-2 grid min-w-56 gap-2 rounded-md border border-[var(--peace-border)] bg-white p-4 shadow-lg"
          >
            {(Object.keys(PARTICIPANT_COLUMNS) as ParticipantColumn[]).map(
              (column) => (
                <label
                  key={column}
                  className="flex min-h-9 items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={preferences.columns.includes(column)}
                    disabled={column === "name"}
                    onChange={(event) =>
                      savePreferences({
                        ...preferences,
                        columns: event.target.checked
                          ? [...preferences.columns, column]
                          : preferences.columns.filter(
                              (item) => item !== column,
                            ),
                      })
                    }
                  />
                  {copy.columns[column]}
                </label>
              ),
            )}
          </fieldset>
        </details>
        <button
          type="button"
          onClick={download}
          disabled={busy}
          aria-busy={busy}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#2f6541] px-4 text-sm font-semibold text-white hover:bg-[#254f34] disabled:opacity-60"
        >
          <Download size={16} aria-hidden="true" />
          {copy.export}
        </button>
        <p className="max-w-xl text-sm leading-6 text-[var(--peace-muted)]">
          {copy.exportHelp}
        </p>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {sorted.length === 0 ? (
        <p className="mt-5 text-sm text-[var(--peace-muted)]">{copy.empty}</p>
      ) : (
        <div className="mt-5 min-w-0 overflow-x-auto rounded-md border border-[var(--peace-border)]">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--peace-border)] bg-[#f7fbfe] text-xs uppercase tracking-wide text-[#6f7f91]">
                {preferences.columns.map((column) => (
                  <th
                    key={column}
                    className="whitespace-nowrap p-3 font-semibold"
                    aria-sort={
                      preferences.sort === column
                        ? preferences.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      type="button"
                      className="inline-flex min-h-9 items-center gap-1"
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
                      {copy.columns[column]}
                      {preferences.sort === column ? (
                        preferences.direction === "asc" ? (
                          <ArrowUp size={14} aria-hidden="true" />
                        ) : (
                          <ArrowDown size={14} aria-hidden="true" />
                        )
                      ) : null}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[var(--peace-border)] align-top hover:bg-[#f7fbfe] last:border-b-0"
                >
                  {preferences.columns.map((column) => (
                    <td key={column} className="whitespace-pre-line p-3">
                      {column === "name" ? (
                        <>
                          <Link
                            scroll={false}
                            href={tablePath({ assignmentId: row.id })}
                            className="font-semibold text-[var(--peace-blue-800)] underline-offset-4 hover:underline"
                          >
                            {row.participantName}
                          </Link>
                          <p className="mt-1 text-xs text-[var(--peace-muted)]">
                            {[row.participantCode, row.participantPlace]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </>
                      ) : column === "tags" && row.tags.length ? (
                        <div className="flex flex-wrap gap-1">
                          {row.tags.map((tag) => (
                            <span
                              key={tag.id}
                              className="inline-flex items-center gap-1 rounded-full border border-[var(--peace-border)] px-2 py-1 text-xs"
                            >
                              <span
                                className="size-2 rounded-full"
                                style={{ backgroundColor: tag.color }}
                              />
                              {tag.label}
                            </span>
                          ))}
                        </div>
                      ) : (
                        leaderCellText(row, column, startsOn, locale)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
