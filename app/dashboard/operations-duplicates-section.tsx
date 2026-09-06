import Link from "next/link";
import { hashIdentityFingerprint } from "@/lib/data-quality/fingerprint.server";
import { qualityAccess } from "@/lib/data-quality/access.server";
import {
  loadCatalog,
  loadDismissals,
  loadQualityPeople,
} from "@/lib/data-quality/data.server";
import {
  DUPLICATE_LABELS,
  findDuplicates,
  identityFingerprint,
} from "@/lib/data-quality/duplicates";
import {
  qualityExpiry,
  sealQualityPayload,
} from "@/lib/data-quality/seal.server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { ReviewPanel } from "@/app/dashboard/participants/data-quality/panels";

export async function OperationsDuplicatesSection({
  dashboard,
  searchParams = {},
}: {
  dashboard: "admin" | "manager";
  searchParams?: Record<string, string | undefined>;
}) {
  const params = {
    pair: searchParams.duplicatePair,
    page: searchParams.duplicatePage,
    show: searchParams.duplicateShow,
  };
  function path(
    changes: Record<string, string | null> = {},
    anchor = "duplicati",
  ) {
    const query = new URLSearchParams(
      Object.entries(searchParams).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
    query.set("section", "iscritti");
    query.delete("edit");
    query.delete("import");
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) query.delete(key);
      else query.set(key, value);
    }
    return `/dashboard/${dashboard}?${query}#${anchor}`;
  }
  const { db, auth, event, canWrite } = await qualityAccess();
  const service = createSupabaseServiceClient();
  const before = await service.rpc("quality_event_version", {
    p_event_id: event.id,
    p_actor_user_id: auth.user.id,
  });
  if (before.error)
    return (
      <section id="duplicati" className="surface-card grid gap-3 p-5">
        <h2 className="text-xl font-semibold">Controllo duplicati</h2>
        <p role="alert">
          Il controllo duplicati non è al momento disponibile. Riprova più
          tardi.
        </p>
      </section>
    );
  const [all, catalog] = await Promise.all([
    loadQualityPeople(db, event.id),
    loadCatalog(db, event.id),
  ]);
  const people = all.filter((person) => !person.deletedAt);
  const dismissed = await loadDismissals(db, event.id, people);
  const matches = findDuplicates(people, dismissed);
  const selected = matches.find(
    (match) => `${match.left}:${match.right}` === params.pair,
  );
  const after = await service.rpc("quality_event_version", {
    p_event_id: event.id,
    p_actor_user_id: auth.user.id,
  });
  const stable = !after.error && before.data === after.data;
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
  const left = selected && people.find((person) => person.id === selected.left);
  const right =
    selected && people.find((person) => person.id === selected.right);
  const sorted =
    left && right
      ? [left, right].sort((a, b) => a.id.localeCompare(b.id))
      : null;
  const token =
    sorted && stable
      ? sealQualityPayload({
          kind: "review-v1",
          actor: auth.user.id,
          eventId: event.id,
          expires: qualityExpiry(),
          version: before.data,
          left: sorted[0].id,
          right: sorted[1].id,
          leftFingerprint: hashIdentityFingerprint(
            identityFingerprint(sorted[0]),
          ),
          rightFingerprint: hashIdentityFingerprint(
            identityFingerprint(sorted[1]),
          ),
        })
      : null;
  return (
    <section
      id="duplicati"
      aria-label="Controllo duplicati"
      className="grid min-w-0 gap-4 rounded-lg border border-[var(--peace-border)] bg-white p-5"
    >
      <h2 className="text-xl font-semibold">Controllo duplicati</h2>
      <p className="text-sm text-[var(--peace-muted)]">
        {event.title} · Controllo su tutte le {people.length} iscrizioni
        operative dell’evento, indipendentemente dai filtri della tabella.
      </p>
      <p className="text-sm">
        Confronta le schede prima di decidere. Nomi simili, contatti familiari e
        omonimie possono produrre falsi positivi. Nessuna corrispondenza viene
        unita automaticamente.
      </p>
      <nav className="flex flex-wrap gap-4">
        <Link
          className="underline"
          href={path({
            duplicateShow: null,
            duplicatePage: null,
            duplicatePair: null,
          })}
        >
          Da revisionare (
          {matches.filter((m) => m.level !== "dismissed").length})
        </Link>
        <Link
          className="underline"
          href={path({
            duplicateShow: "dismissed",
            duplicatePage: null,
            duplicatePair: null,
          })}
        >
          Falsi positivi verificati (
          {matches.filter((m) => m.level === "dismissed").length})
        </Link>
      </nav>
      {!stable && (
        <p role="alert">
          I dati sono cambiati durante il caricamento. Ricarica prima di
          decidere.
        </p>
      )}
      {visible.slice((page - 1) * 50, page * 50).map((match) => (
        <Link
          key={`${match.left}:${match.right}`}
          className="grid gap-1 rounded-md border p-3 hover:bg-sky-50"
          href={path(
            { duplicatePair: `${match.left}:${match.right}` },
            "confronto",
          )}
        >
          <strong>
            {people.find((p) => p.id === match.left)?.name} ↔{" "}
            {people.find((p) => p.id === match.right)?.name}
          </strong>
          <span>{DUPLICATE_LABELS[match.level]}</span>
          <span className="text-sm text-gray-600">
            {match.signals.join(" · ")}
          </span>
        </Link>
      ))}
      {visible.length === 0 && <p>Nessun caso in questa vista.</p>}
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
      {left && right && (
        <ReviewPanel
          key={`${left.id}:${right.id}:${before.data}`}
          left={left}
          right={right}
          catalog={catalog}
          token={token ?? ""}
          canWrite={canWrite && Boolean(token)}
          returnTo={path({ duplicatePair: null })}
        />
      )}
    </section>
  );
}
