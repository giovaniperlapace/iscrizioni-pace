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
import { ImportPanel, ReviewPanel } from "./panels";

export default async function DataQualityPage({
  searchParams,
}: {
  searchParams: Promise<{ pair?: string; page?: string; show?: string }>;
}) {
  const params = await searchParams;
  const { db, auth, event, isAdmin, canWrite } = await qualityAccess();
  const service = createSupabaseServiceClient();
  const before = await service.rpc("quality_event_version", {
    p_event_id: event.id,
    p_actor_user_id: auth.user.id,
  });
  if (before.error) throw new Error("Controllo qualità non disponibile.");
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
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8">
      <Link
        className="underline"
        href={`/dashboard/${isAdmin ? "admin" : "manager"}?section=iscritti`}
      >
        ← Gestione iscritti
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Qualità dati e scambio Excel</h1>
        <p className="mt-2 text-sm">
          {event.title} · {people.length} iscrizioni operative
        </p>
      </div>
      <div className="flex flex-wrap gap-4">
        <Link
          className="underline"
          href="/dashboard/participants/data-quality/instructions"
        >
          Istruzioni di importazione
        </Link>
        <a
          download
          className="underline"
          href="/dashboard/participants/data-quality/api?kind=template"
        >
          Scarica modello Excel vuoto
        </a>
      </div>
      {canWrite ? (
        <ImportPanel />
      ) : (
        <p>
          Hai accesso in sola lettura. Importazione e decisioni sono riservate a
          manager e admin.
        </p>
      )}
      <section className="grid gap-4 rounded-lg border bg-white p-4">
        <h2 className="text-xl font-semibold">Revisione duplicati</h2>
        <p className="text-sm">
          Confronta le schede prima di decidere. Nomi simili, contatti familiari
          e omonimie possono produrre falsi positivi. Nessuna corrispondenza
          viene unita automaticamente.
        </p>
        <nav className="flex flex-wrap gap-4">
          <Link
            className="underline"
            href="/dashboard/participants/data-quality"
          >
            Da revisionare (
            {matches.filter((m) => m.level !== "dismissed").length})
          </Link>
          <Link className="underline" href="?show=dismissed">
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
            href={`?pair=${match.left}:${match.right}${params.show === "dismissed" ? "&show=dismissed" : ""}#confronto`}
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
              <Link href={`?page=${page - 1}&show=${params.show ?? ""}`}>
                Precedente
              </Link>
            )}
            <span>
              Pagina {page} di {pageCount}
            </span>
            {page < pageCount && (
              <Link href={`?page=${page + 1}&show=${params.show ?? ""}`}>
                Successiva
              </Link>
            )}
          </nav>
        )}
      </section>
      {left && right && (
        <ReviewPanel
          key={`${left.id}:${right.id}:${before.data}`}
          left={left}
          right={right}
          catalog={catalog}
          token={token ?? ""}
          canWrite={canWrite && Boolean(token)}
        />
      )}
    </main>
  );
}
