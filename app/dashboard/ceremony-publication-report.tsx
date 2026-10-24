"use client";
import { useEffect, useRef, useState } from "react";
import {
  PUBLICATION_EMAIL_LABELS as labels,
  type PublicationReport,
} from "@/lib/ceremonies/publication-report";
const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("it-IT", {
        timeZone: "Europe/Rome",
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";
const reasons: Record<string, string> = {
  recipient_unavailable: "Contatto non disponibile",
  assignment_no_longer_active:
    "Assegnazione revocata o destinatario non più abilitato",
  preparation_failed: "Preparazione dell’email non riuscita",
  interrupted: "Invio interrotto: esito da verificare",
};
export function CeremonyPublicationReport({
  planId,
  revision,
}: {
  planId: string;
  revision: number;
}) {
  const [result, setResult] = useState<{
    key: string;
    data: PublicationReport | null;
  } | null>(null);
  const [publication, setPublication] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");
  const title = useRef<HTMLHeadingElement>(null);
  const generation = useRef(0);
  const url = `/dashboard/ceremonies/publications?${new URLSearchParams({ planId, ...(publication ? { publication } : {}) })}`;
  const key = `${url}-${revision}-${refresh}`;
  const loading = result?.key !== key;
  const report = !loading ? result?.data : null;
  useEffect(() => {
    title.current?.focus({ preventScroll: true });
    title.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const token = ++generation.current;
    fetch(url, { cache: "no-store", signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((data) => {
        if (!controller.signal.aborted) setResult({ key, data });
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setMessage("Impossibile caricare il report. Premi Aggiorna report.");
          setResult({ key, data: null });
        }
      });
    return () => {
      controller.abort();
      generation.current = token + 1;
    };
  }, [url, key]);
  async function check() {
    if (!report?.selected || checking) return;
    const token = generation.current;
    setChecking(true);
    setMessage("");
    try {
      const r = await fetch(
        `/dashboard/ceremonies/publications?${new URLSearchParams({ planId, publication: report.selected })}`,
        { method: "POST" },
      );
      const d = await r.json();
      if (!r.ok) throw Error();
      if (token !== generation.current) return;
      setMessage(
        d.disabled
          ? "Verifica consegne non attiva in questo ambiente."
          : `${d.checked} invii verificati.${d.unavailable ? ` ${d.unavailable} verifiche non disponibili: gli esiti precedenti sono conservati.` : ""} Per altri invii premi nuovamente Verifica consegne.`,
      );
      setRefresh((v) => v + 1);
    } catch {
      if (token === generation.current)
        setMessage(
          "Verifica delle consegne non disponibile. Gli esiti già registrati sono conservati.",
        );
    } finally {
      setChecking(false);
    }
  }
  const filtered = (report?.recipients ?? []).filter(
    (r) =>
      (!filter || r.state === filter) &&
      `${r.name} ${r.recipient ?? ""}`
        .toLocaleLowerCase("it")
        .includes(search.trim().toLocaleLowerCase("it")),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 50)),
    current = Math.min(page, pages);
  return (
    <section
      className="min-w-0 border-t border-[var(--peace-border)] pt-5"
      aria-label="Report notifiche cerimonia"
    >
      <h3 ref={title} tabIndex={-1} className="scroll-mt-24 font-bold">
        Report invii della cerimonia
      </h3>
      <div className="my-3 flex flex-wrap items-end gap-3">
        <label className="grid min-w-0 gap-1">
          Pubblicazione
          <select
            className="field max-w-full"
            disabled={loading || checking}
            value={publication}
            onChange={(e) => {
              setPublication(e.target.value);
              setSearch("");
              setFilter("");
              setMessage("");
            }}
          >
            <option value="">Ultima pubblicazione</option>
            {report?.publications.map((p) => (
              <option key={p.id} value={p.id}>
                {date(p.date)} · {p.seats} posti · {p.emails} email
              </option>
            ))}
          </select>
        </label>
        <button
          className="btn-secondary px-3 py-2"
          type="button"
          disabled={loading || checking}
          onClick={() => {
            setMessage("");
            setRefresh((v) => v + 1);
          }}
        >
          Aggiorna report
        </button>
        <button
          className="btn-secondary px-3 py-2"
          type="button"
          disabled={loading || checking || !report?.selected}
          onClick={() => void check()}
        >
          {checking ? "Verifica in corso…" : "Verifica consegne"}
        </button>
        {report?.selected && (
          <a
            className="btn-secondary px-3 py-2"
            href={`/dashboard/ceremonies/publications?${new URLSearchParams({ planId, publication: report.selected, format: "csv" })}`}
          >
            Esporta CSV completo
          </a>
        )}
      </div>
      <p className="text-sm text-[var(--peace-muted)]">
        L’accettazione del servizio di invio non conferma la consegna. «Verifica
        consegne» controlla fino a 20 invii alla volta, iniziando da quelli
        verificati meno di recente. La consegna al server non certifica la
        lettura. Gli esiti incerti non vengono reinviati automaticamente.
      </p>
      {loading && (
        <p role="status" className="my-3">
          Caricamento del report…
        </p>
      )}
      {message && (
        <p role="status" className="my-3">
          {message}
        </p>
      )}
      {report && (
        <>
          <div className="my-3 flex flex-wrap gap-2">
            {Object.entries(report.counts).map(([key, n]) => (
              <span
                key={key}
                className="rounded border border-[var(--peace-border)] px-3 py-2 text-sm"
              >
                {labels[key] ?? key}: <strong>{n}</strong>
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="grid min-w-0 flex-1 gap-1">
              Cerca nome, gruppo o email
              <input
                className="field"
                value={search}
                maxLength={200}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label className="grid min-w-0 gap-1">
              Esito
              <select
                className="field"
                aria-label="Esito"
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Tutti gli esiti</option>
                {Object.entries(labels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th>Destinatario</th>
                  <th>Email di invio</th>
                  <th>Esito</th>
                  <th>Dettagli</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice((current - 1) * 50, current * 50).map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-[var(--peace-border)] align-top"
                  >
                    <td className="min-w-40 py-3 pr-3">
                      <strong>{r.name}</strong>
                      <span className="block text-xs text-[var(--peace-muted)]">
                        {r.kind === "leader"
                          ? "Capogruppo · posti da abbinare"
                          : "Assegnazione nominale"}
                      </span>
                    </td>
                    <td className="max-w-56 break-words py-3 pr-3">
                      {r.recipient ?? "Indirizzo non ancora determinato"}
                    </td>
                    <td className="min-w-40 py-3 pr-3">
                      {labels[r.state] ?? r.state}
                      {r.reason && (
                        <span className="block text-xs">
                          {reasons[r.reason] ?? r.reason}
                        </span>
                      )}
                    </td>
                    <td className="min-w-48 py-3">
                      <details>
                        <summary className="cursor-pointer underline">
                          Dettagli invio
                        </summary>
                        <dl className="my-2">
                          <dt>Accettata (Roma)</dt>
                          <dd>{date(r.acceptedAt)}</dd>
                          <dt>Esito consegna (Roma)</dt>
                          <dd>{date(r.deliveryAt)}</dd>
                          <dt>Ultima verifica (Roma)</dt>
                          <dd>{date(r.checkedAt)}</dd>
                        </dl>
                        {r.subject && (
                          <>
                            <strong>{r.subject}</strong>
                            <p className="mt-2 max-w-md whitespace-pre-wrap break-words">
                              {r.text}
                            </p>
                            <p className="mt-2 text-xs text-[var(--peace-muted)]">
                              Testo e indirizzo salvati per questo invio.
                            </p>
                          </>
                        )}
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filtered.length && (
            <p className="mt-3">Nessun invio corrisponde ai filtri.</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn-secondary px-3 py-2"
              disabled={current <= 1}
              onClick={() => setPage(current - 1)}
            >
              Precedenti
            </button>
            <span>
              Pagina {current} di {pages} · {filtered.length} invii
            </span>
            <button
              type="button"
              className="btn-secondary px-3 py-2"
              disabled={current >= pages}
              onClick={() => setPage(current + 1)}
            >
              Successive
            </button>
          </div>
        </>
      )}
    </section>
  );
}
