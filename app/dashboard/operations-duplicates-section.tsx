import { loadDuplicateForumActivity } from "@/lib/data-quality/forum-activity.server";
import { randomUUID } from "node:crypto";
import { DuplicateListProvider, DuplicateListCount } from "@/app/dashboard/participants/data-quality/list-state";
import Link from "@/components/pending-link";
import { OperationsDuplicatesTable } from "@/app/dashboard/operations-duplicates-table";
import { DuplicateReviewLoader } from "@/app/dashboard/participants/data-quality/review-loader";
import { qualityAccess } from "@/lib/data-quality/access.server";
import { loadDismissals, loadQualityPeople } from "@/lib/data-quality/data.server";
import { findDuplicates, pairKey } from "@/lib/data-quality/duplicates";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function OperationsDuplicatesSection({
  dashboard,
  searchParams = {},
}: {
  dashboard: "admin" | "manager";
  searchParams?: Record<string, string | undefined>;
}) {
  const params = {
    page: searchParams.duplicatePage,
    show: searchParams.duplicateShow,
  };
  function path(changes: Record<string, string | null> = {}) {
    const query = new URLSearchParams(
      Object.entries(searchParams).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
    query.set("section", "iscritti");
    query.set("view", "duplicates");
    query.delete("duplicateAction");
    query.delete("duplicateDelete");
    query.delete("edit");
    query.delete("import");
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) query.delete(key);
      else query.set(key, value);
    }
    return `/dashboard/${dashboard}?${query}`;
  }
  const { db, event, canWrite } = await qualityAccess();
  const service = createSupabaseServiceClient();
  const all = await loadQualityPeople(db, event.id);
  const people = all.filter((person) => !person.deletedAt);
  const dismissed = await loadDismissals(db, event.id, people);
  const matches = findDuplicates(people, dismissed);
  const visible = matches.filter((match) =>
    params.show === "dismissed"
      ? match.level === "dismissed"
      : match.level !== "dismissed",
  );
  const pageCount = Math.max(1, Math.ceil(visible.length / 50));
  const page = Math.min(
    pageCount,
    Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1),
  );
  const pageMatches = visible.slice((page - 1) * 50, page * 50);
  const forumActivity = await loadDuplicateForumActivity(
    service,
    event.id,
    [...new Set(pageMatches.flatMap(match => [match.left, match.right]))],
  ).catch(() => null);
  return (
    <section
      id="duplicati"
      aria-label="Controllo duplicati"
      className="grid min-w-0 gap-5 rounded-xl border border-amber-200 bg-amber-50/30 p-4 sm:p-6"
    >
      <h2 className="text-xl font-semibold">Duplicati</h2>
      <p className="text-sm text-[var(--peace-muted)]">
        Verifica le possibili iscrizioni duplicate tra le {people.length}{" "}
        iscrizioni di {event.title}.
      </p>
      <p className="text-sm">
        Confronta le schede prima di decidere. Nomi simili, contatti familiari e
        omonimie possono produrre falsi positivi. Puoi eliminare una sola
        iscrizione mantenendo l’altra, oppure segnalarle come persone distinte.
      </p>
      {/* A fresh server snapshot replaces local confirmations, including newly detected pairs. */}
      <DuplicateListProvider key={randomUUID()} pendingPairs={pageMatches.filter(match => match.level !== "dismissed").map(match => pairKey(match.left, match.right))}>
        <nav aria-label="Viste duplicati" className="flex flex-wrap gap-2">
          <Link
            className={
              params.show !== "dismissed"
                ? "btn-primary px-4 py-2 text-sm"
                : "btn-secondary px-4 py-2 text-sm"
            }
            aria-current={params.show !== "dismissed" ? "page" : undefined}
            scroll={false}
            href={path({
              duplicateShow: null,
              duplicatePage: null,
              duplicatePair: null,
            })}
          >
            Da verificare (<DuplicateListCount value={matches.filter((m) => m.level !== "dismissed").length} />
            )
          </Link>
          <Link
            className={
              params.show === "dismissed"
                ? "btn-primary px-4 py-2 text-sm"
                : "btn-secondary px-4 py-2 text-sm"
            }
            aria-current={params.show === "dismissed" ? "page" : undefined}
            scroll={false}
            href={path({
              duplicateShow: "dismissed",
              duplicatePage: null,
              duplicatePair: null,
            })}
          >
            Esclusi (<DuplicateListCount value={matches.filter((m) => m.level === "dismissed").length} excluded />)
          </Link>
        </nav>
        <h3 className="text-lg font-semibold">
          {params.show === "dismissed"
            ? "Segnalazioni escluse"
            : "Possibili duplicati"}{" "}
          (<DuplicateListCount value={visible.length} excluded={params.show === "dismissed"} label />)
        </h3>
        <p className="text-sm text-[var(--peace-muted)]">
          Il contatore somma i Forum prenotati e quelli in coda, fino a un massimo
          visualizzato di 3, comprese le prenotazioni inserite dal capogruppo.
        </p>
        {forumActivity === null && (
          <p role="alert">Impossibile caricare i Forum. Ricarica la pagina prima di valutare l’attività degli account.</p>
        )}
        <OperationsDuplicatesTable
          matches={pageMatches}
          forumActivity={forumActivity}
          people={people}
          basePath={path({ duplicatePair: null })}
          canWrite={canWrite}
        />
        {pageCount > 1 && (
          <nav className="flex gap-4" aria-label="Pagine duplicati">
            {page > 1 && (
              <Link
                href={path({
                  duplicatePage: String(page - 1),
                  duplicatePair: null,
                })}
              >
                Precedente
              </Link>
            )}
            <span>
              Pagina {page} di {pageCount}
            </span>
            {page < pageCount && (
              <Link
                href={path({
                  duplicatePage: String(page + 1),
                  duplicatePair: null,
                })}
              >
                Successiva
              </Link>
            )}
          </nav>
        )}
        <DuplicateReviewLoader dashboard={dashboard} />
      </DuplicateListProvider>
    </section>
  );
}
