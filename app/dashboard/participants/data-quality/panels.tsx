"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileSpreadsheet, Upload } from "lucide-react";
import { DUPLICATE_LABELS } from "@/lib/data-quality/duplicates";
import type { PreviewRow, RowDecision } from "@/lib/data-quality/preview";
import type { QualityPerson } from "@/lib/data-quality/data.server";
import type { Catalog } from "@/lib/data-quality/format";

const endpoint = "/dashboard/participants/data-quality/api";
const button =
  "min-h-11 rounded-md border border-blue-800 px-4 py-2 font-semibold text-blue-900 disabled:opacity-50";
async function send(body: FormData | object) {
  const response = await fetch(
    endpoint,
    body instanceof FormData
      ? { method: "POST", body }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Operazione non riuscita.");
  return result;
}
export function ImportPanel() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{
    rows: PreviewRow[];
    token: string;
  } | null>(null);
  const [decisions, setDecisions] = useState<RowDecision[]>([]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setSuccess("");
    setPreview(null);
    setConfirmed(false);
    try {
      const result = (await send(form)) as {
        rows: PreviewRow[];
        token: string;
      };
      setPreview(result);
      setDecisions(
        result.rows.map((row) => ({
          row: row.row,
          action: "import",
          reason: "",
        })),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Caricamento non riuscito.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    if (!preview) return;
    setBusy(true);
    setError("");
    try {
      const result = await send({
        action: "commit",
        token: preview.token,
        decisions,
        confirm: confirmed,
      });
      setSuccess(
        `Importazione completata: ${result.imported} iscrizioni create, ${result.skipped} righe scartate.${result.replayed ? " Conferma già elaborata: nessuna copia aggiunta." : ""}`,
      );
      setPreview(null);
      setConfirmed(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Importazione non riuscita.",
      );
    } finally {
      setBusy(false);
    }
  }
  const imports = decisions.filter((item) => item.action === "import").length;
  const unresolved = preview?.rows.some((row) => {
    const decision = decisions.find((item) => item.row === row.row)!;
    return (
      (decision.action === "import" &&
        (row.errors.length > 0 ||
          row.candidates.some((match) => match.archived))) ||
      ((decision.action === "skip" || row.candidates.length > 0) &&
        decision.reason.trim().length < 3)
    );
  });
  return (
    <section aria-labelledby="import-upload-title" className="grid min-w-0 grid-cols-1 gap-4 border-t border-[var(--peace-border)] pt-5">
      <div>
        <h3 id="import-upload-title" className="font-semibold text-[var(--peace-blue-900)]">2. Scegli il file compilato</h3>
        <p id="import-file-help" className="mt-1 text-sm text-[var(--peace-muted)]">
          Seleziona dal tuo computer il file Excel (.xlsx). Massimo 2 MB e 500 persone.
        </p>
      </div>
      <form onSubmit={upload} className="grid gap-3">
        <div className="relative min-w-0">
          <input
            id="import-excel-file"
            className="peer sr-only"
            type="file"
            name="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            aria-label="Scegli file Excel"
            aria-describedby="import-file-help import-selected-file"
            required
            disabled={busy}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setPreview(null);
              setConfirmed(false);
              setError("");
              setSuccess("");
            }}
          />
          <label
            htmlFor="import-excel-file"
            className="flex min-w-0 cursor-pointer flex-wrap items-center gap-3 rounded-xl border border-dashed border-[var(--peace-border-strong)] bg-[var(--peace-soft)] p-4 transition-colors hover:border-[var(--peace-blue-800)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--peace-blue-800)] peer-disabled:pointer-events-none peer-disabled:opacity-60 sm:p-5"
          >
            <FileSpreadsheet size={26} aria-hidden className="shrink-0 text-[var(--peace-blue-800)]" />
            <span id="import-selected-file" role="status" className="min-w-0 flex-1 basis-40 text-sm">
              <span className="block break-all font-semibold text-[var(--peace-ink)]">
                {file ? file.name : "Nessun file selezionato"}
              </span>
              <span className="mt-1 block text-[var(--peace-muted)]">
                {file ? "Puoi scegliere un altro file prima di continuare." : "Premi Scegli file Excel per cercarlo sul tuo computer."}
              </span>
            </span>
            <span className="btn-secondary inline-flex items-center gap-2 bg-white px-4 py-2 text-sm">
              <Upload size={18} aria-hidden />
              {file ? "Cambia file Excel" : "Scegli file Excel"}
            </span>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-primary px-5 py-2 text-sm" disabled={busy || !file}>
            Mostra anteprima
          </button>
          <p className="text-sm text-[var(--peace-muted)]">
            Nessuna iscrizione verrà aggiunta fino alla tua conferma finale.
          </p>
        </div>
      </form>
      {busy && (
        <p role="status" aria-live="polite">
          Operazione in corso…
        </p>
      )}
      {error && (
        <p role="alert" className="status-error rounded-xl border p-3 text-sm">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="status-success rounded-xl border p-3 text-sm">
          {success}{" "}
          <Link
            className="underline"
            href="/dashboard/manager?section=iscritti"
          >
            Apri gli iscritti
          </Link>
        </p>
      )}
      {preview && (
        <>
          <h3 className="border-t border-[var(--peace-border)] pt-5 font-semibold text-[var(--peace-blue-900)]">
            3. Controlla e conferma: {preview.rows.length} righe
          </h3>
          <p>
            {preview.rows.filter((row) => !row.errors.length).length} valide ·{" "}
            {preview.rows.filter((row) => row.errors.length).length} con errori
            · {preview.rows.filter((row) => row.candidates.length).length} con
            possibili duplicati
          </p>
          <div
            className="max-h-[60vh] min-w-0 overflow-auto rounded-xl border border-[var(--peace-border)]"
            tabIndex={0}
            aria-label="Anteprima importazione"
          >
            <table className="w-full min-w-[750px] text-left text-sm">
              <thead className="bg-[var(--peace-soft)] text-[var(--peace-blue-900)]">
                <tr>
                  <th className="p-2">Riga e dati</th>
                  <th className="p-2">Controlli</th>
                  <th className="p-2">Decisione</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => {
                  const decision = decisions.find(
                    (item) => item.row === row.row,
                  )!;
                  const change = (patch: Partial<RowDecision>) => {
                    setConfirmed(false);
                    setDecisions((current) =>
                      current.map((item) =>
                        item.row === row.row ? { ...item, ...patch } : item,
                      ),
                    );
                  };
                  return (
                    <tr key={row.row} className="border-t border-[var(--peace-border)] align-top">
                      <td className="p-2">
                        <strong>
                          Riga {row.row}: {row.values.nome} {row.values.cognome}
                        </strong>
                        <dl>
                          {Object.entries(row.values)
                            .filter(
                              ([key]) => key !== "nome" && key !== "cognome",
                            )
                            .map(([key, value]) => (
                              <div key={key} className="break-words">
                                <dt className="inline text-[var(--peace-muted)]">
                                  {key}:{" "}
                                </dt>
                                <dd className="inline">{value || "—"}</dd>
                              </div>
                            ))}
                        </dl>
                      </td>
                      <td className="max-w-sm p-2">
                        {row.errors.map((text) => (
                          <p key={text} className="mb-1 text-red-800">
                            {text}
                          </p>
                        ))}
                        {row.candidates.map((match) => (
                          <p className="mb-2" key={match.right}>
                            <strong>{DUPLICATE_LABELS[match.level]}</strong>:{" "}
                            {match.name}
                            <br />
                            {match.signals.join(" · ")}
                          </p>
                        ))}
                        {!row.errors.length && !row.candidates.length && (
                          <p className="text-green-800">
                            Pronta per l’importazione, nessun duplicato rilevato
                          </p>
                        )}
                      </td>
                      <td className="min-w-60 p-2">
                        <label className="grid gap-1">
                          Scelta per riga {row.row}
                          <select
                            className="field"
                            value={decision.action}
                            disabled={busy}
                            onChange={(event) =>
                              change({
                                action: event.target
                                  .value as RowDecision["action"],
                              })
                            }
                          >
                            <option value="import">
                              {row.candidates.length
                                ? "Importa come persona distinta"
                                : "Importa"}
                            </option>
                            <option value="skip">Scarta questa riga</option>
                          </select>
                        </label>
                        {(decision.action === "skip" ||
                          row.candidates.length > 0) && (
                          <label className="mt-2 grid gap-1">
                            Motivazione per riga {row.row}
                            <textarea
                              className="field"
                              minLength={3}
                              maxLength={500}
                              value={decision.reason}
                              disabled={busy}
                              onChange={(event) =>
                                change({ reason: event.target.value })
                              }
                            />
                          </label>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="font-semibold">
            Conferma finale: {imports} nuove iscrizioni,{" "}
            {decisions.length - imports} righe scartate.
          </p>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={busy || unresolved}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-1"
            />
            Confermo queste scelte e attesto che i consensi indicati nel file
            sono già stati raccolti e sono disponibili.
          </label>
          {unresolved && (
            <p>
              Correggi il file e caricalo di nuovo oppure scarta le righe con errori.
              Per i possibili duplicati, indica il motivo della tua scelta prima di confermare.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              className="btn-primary px-5 py-2 text-sm"
              disabled={busy || !confirmed || unresolved}
              onClick={() => void commit()}
            >
              Conferma importazione
            </button>
            <button
              className="btn-secondary px-4 py-2 text-sm disabled:opacity-50"
              disabled={busy}
              onClick={() => {
                setPreview(null);
                setConfirmed(false);
              }}
            >
              Annulla anteprima
            </button>
          </div>
        </>
      )}
    </section>
  );
}
export function ReviewPanel({
  left,
  right,
  catalog,
  token,
  canWrite,
  returnTo = "/dashboard/manager?section=iscritti&view=duplicates",
  excludeOnly = false,
}: {
  left: QualityPerson;
  right: QualityPerson;
  catalog: Catalog;
  token: string;
  canWrite: boolean;
  returnTo?: string;
  excludeOnly?: boolean;
}) {
  const router = useRouter();
  const [decision, setDecision] = useState("not_duplicate"),
    [keepId, setKeepId] = useState("");
  const [reason, setReason] = useState(""),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function review(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await send({
        action: "review",
        token,
        decision,
        keepId,
        reason,
        confirm,
      });
      router.push(returnTo, { scroll: false });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decisione non salvata.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="grid min-w-0 grid-cols-1 gap-4"
      id="confronto"
      aria-label="Confronto schede"
    >
      <h2 className="text-xl font-semibold">Confronto schede</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {[left, right].map((person) => (
          <article
            key={person.id}
            className="rounded-xl border border-[var(--peace-border)] bg-[var(--peace-soft)] p-4"
          >
            <h3 className="font-bold">{person.name}</h3>
            <dl className="mt-2 space-y-1 text-sm">
              {Object.entries({
                Codice: person.publicCode,
                "Data di nascita": person.birthDate,
                Email: person.email,
                Telefono: person.phone,
                Paese: person.country,
                Città: person.city,
                Gruppo: person.currentGroupName,
                Servizio: catalog.services.find(
                  (item) => item.id === person.currentServiceId,
                )?.label,
                Tag: person.tagIds
                  .map(
                    (id) => catalog.tags.find((t) => t.id === id)?.label ?? id,
                  )
                  .join(", "),
                "Minori accompagnati": String(person.children.length),
                "Account collegato": person.authUserId ? "Sì" : "No",
              }).map(([label, value]) => (
                <div className="break-words" key={label}>
                  <dt className="inline text-gray-600">{label}: </dt>
                  <dd className="inline">{value || "—"}</dd>
                </div>
              ))}
            </dl>
            <Link
              className="mt-3 block underline"
              href={`${returnTo.split("#")[0]}&edit=${person.id}`}
              scroll={false}
            >
              Apri scheda completa
            </Link>
          </article>
        ))}
      </div>
      {!excludeOnly && (
        <>
          <p className="text-sm">
            Conserva la scheda con i dati corretti: i valori già presenti
            prevalgono; i campi mancanti vengono completati. I tag vengono
            riuniti. La seconda iscrizione sarà archiviata con storico
            conservato e QR revocato.
          </p>
          <p className="text-sm">
            Account distinti, identità su altri eventi o una scheda da
            archiviare con minori, check-in, momenti o bisogni di accessibilità
            richiedono una riconciliazione dedicata.{" "}
            <Link
              className="underline"
              href="/dashboard/participants/data-quality/instructions"
            >
              Leggi tutti gli effetti del merge
            </Link>
            .
          </p>
        </>
      )}
      {canWrite && (
        <form onSubmit={review} className="grid gap-3">
          {!excludeOnly && (
            <label className="grid gap-1">
              Esito
              <select
                className="field"
                value={decision}
                disabled={busy}
                onChange={(event) => {
                  setDecision(event.target.value);
                  setConfirm(false);
                }}
              >
                <option value="not_duplicate">Non sono duplicati</option>
                <option value="merged">Unisci le iscrizioni</option>
              </select>
            </label>
          )}
          {decision === "merged" && (
            <fieldset className="grid gap-2">
              <legend>Scheda da conservare (scelta obbligatoria)</legend>
              {[left, right].map((person) => (
                <label key={person.id} className="flex gap-2">
                  <input
                    type="radio"
                    name="keep"
                    required
                    value={person.id}
                    checked={keepId === person.id}
                    disabled={busy}
                    onChange={() => {
                      setKeepId(person.id);
                      setConfirm(false);
                    }}
                  />
                  {person.name} · {person.publicCode}
                </label>
              ))}
            </fieldset>
          )}
          <label className="grid gap-1">
            Motivazione
            <textarea
              className="field"
              required
              minLength={3}
              maxLength={500}
              value={reason}
              disabled={busy}
              onChange={(event) => {
                setReason(event.target.value);
                setConfirm(false);
              }}
            />
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              required
              checked={confirm}
              disabled={busy}
              onChange={(event) => setConfirm(event.target.checked)}
              className="mt-1"
            />
            Ho confrontato le schede e confermo questo esito
            {decision === "merged"
              ? `, conservando ${[left, right].find((person) => person.id === keepId)?.publicCode ?? "la scheda da scegliere"}`
              : ""}
            .
          </label>
          {error && (
            <p role="alert" className="text-red-800">
              {error}
            </p>
          )}
          <button
            className={button}
            disabled={busy || !confirm || (decision === "merged" && !keepId)}
          >
            {busy
              ? "Salvataggio…"
              : excludeOnly
                ? "Conferma esclusione"
                : "Conferma decisione"}
          </button>
        </form>
      )}
    </section>
  );
}
