import Link from "next/link";
import {
  DUPLICATE_LABELS,
  type DuplicateMatch,
} from "@/lib/data-quality/duplicates";
import type { QualityPerson } from "@/lib/data-quality/data.server";

export function OperationsDuplicatesTable({
  matches,
  people,
  basePath,
  canWrite,
}: {
  matches: DuplicateMatch[];
  people: QualityPerson[];
  basePath: string;
  canWrite: boolean;
}) {
  const byId = new Map(people.map((person) => [person.id, person]));
  const firstPairByPerson = new Map<string, DuplicateMatch>();
  for (const match of matches) {
    for (const id of [match.left, match.right]) {
      if (!firstPairByPerson.has(id)) firstPairByPerson.set(id, match);
    }
  }
  function href(changes: Record<string, string>) {
    const url = new URL(basePath, "https://local.invalid");
    url.hash = "";
    for (const key of ["edit", "duplicatePair", "duplicateAction"])
      url.searchParams.delete(key);
    for (const [key, value] of Object.entries(changes))
      url.searchParams.set(key, value);
    return `${url.pathname}?${url.searchParams}`;
  }
  const actionClass =
    "inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--peace-border-strong)] bg-white px-3 py-2 text-sm font-semibold text-[var(--peace-blue-800)] hover:bg-[var(--peace-sky-100)]";
  return (
    <div
      className="min-w-0 overflow-x-auto rounded-xl border border-[var(--peace-border)]"
      tabIndex={0}
      role="region"
      aria-label="Tabella possibili duplicati"
    >
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="bg-[var(--peace-soft)] text-[var(--peace-blue-900)]">
          <tr>
            {[
              "Partecipante",
              "Email",
              "Gruppo",
              "Motivo",
              "Confronta con",
              "Azioni",
            ].map((label) => (
              <th key={label} scope="col" className="px-4 py-4 font-semibold">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matches.flatMap((match) => {
            const left = byId.get(match.left),
              right = byId.get(match.right);
            if (!left || !right) return [];
            const pair = `${match.left}:${match.right}`;
            return [
              [left, right],
              [right, left],
            ].map(([person, other], index) => (
              <tr
                key={`${pair}:${person.id}`}
                className={`border-t border-[var(--peace-border)] bg-white ${index === 0 ? "border-t-2" : ""}`}
              >
                <td className="px-4 py-4">
                  <Link
                    id={
                      firstPairByPerson.get(person.id) === match
                        ? `participant-${person.id}`
                        : undefined
                    }
                    className="font-semibold text-[var(--peace-ink)] hover:underline"
                    href={href({ edit: person.id })}
                    scroll={false}
                    prefetch={false}
                  >
                    {person.name}
                  </Link>
                  <p className="mt-1 text-xs text-[var(--peace-muted)]">
                    {person.publicCode}
                  </p>
                </td>
                <td className="max-w-64 break-words px-4 py-4 text-[var(--peace-muted)]">
                  {person.email || "—"}
                </td>
                <td className="px-4 py-4 text-[var(--peace-muted)]">
                  {person.currentGroupName || "—"}
                </td>
                <td className="min-w-48 px-4 py-4">
                  <p className="font-medium">{DUPLICATE_LABELS[match.level]}</p>
                  <p className="mt-1 text-[var(--peace-muted)]">
                    {match.signals.join(" · ")}
                  </p>
                </td>
                <td className="px-4 py-4">
                  <Link
                    className="text-[var(--peace-blue-800)] underline underline-offset-2"
                    href={href({ duplicatePair: pair })}
                    scroll={false}
                    prefetch={false}
                    aria-label={`Confronta ${person.name} (${person.publicCode}) con ${other.name} (${other.publicCode})`}
                  >
                    {other.name}
                  </Link>
                  <p className="mt-1 text-xs text-[var(--peace-muted)]">
                    {other.publicCode}
                  </p>
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-col items-start gap-2">
                    <Link
                      className={actionClass}
                      href={href({ edit: person.id })}
                      scroll={false}
                      prefetch={false}
                      aria-label={`${canWrite ? "Modifica" : "Apri scheda di"} ${person.name} (${person.publicCode})`}
                    >
                      {canWrite ? "Modifica" : "Apri scheda"}
                    </Link>
                    {canWrite && match.level !== "dismissed" && (
                      <Link
                        className={actionClass}
                        href={href({
                          duplicatePair: pair,
                          duplicateAction: "exclude",
                        })}
                        scroll={false}
                        prefetch={false}
                        aria-label={`Escludi segnalazione tra ${person.name} (${person.publicCode}) e ${other.name} (${other.publicCode})`}
                      >
                        Escludi
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ));
          })}
          {!matches.length && (
            <tr>
              <td colSpan={6} className="p-5 text-[var(--peace-muted)]">
                Nessun caso in questa vista.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
