"use client";
import { useEffect, useRef, useState } from "react";
import { ProgressButton } from "@/components/button-progress";
type Campaign = {
  id: string;
  name: string;
  status: string;
  recipientCount: number;
  date: string;
};
type Recipient = {
  id: string;
  name: string;
  email: string;
  snapshot: boolean;
  code: string;
  label: string;
  reason: string;
  sentAt: string | null;
  deliveredAt: string | null;
  retryable: boolean;
  retryCampaignId: string | null;
};
type Report = {
  campaign: { id: string; name: string; date: string; parent: string | null };
  counts: Record<string, number>;
  recipients: Recipient[];
};
const labels: Record<string, string> = {
  delivered: "Consegnate al server",
  accepted: "Accettate, consegna non confermata",
  bounced: "Non recapitate",
  failed: "Invio fallito",
  blocked: "Bloccate / disiscritte",
  unknown: "Da verificare",
  queued: "In attesa",
  excluded: "Escluse",
};
const date = (v: string | null) =>
  v
    ? new Intl.DateTimeFormat("it-IT", {
        timeZone: "Europe/Rome",
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(v))
    : "—";
export function CampaignHistory() {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const update = () => setRevision((n) => n + 1);
    window.addEventListener("email-campaign-queued", update);
    return () => window.removeEventListener("email-campaign-queued", update);
  }, []);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [rowPage, setRowPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const generation = useRef(0);
  const detail = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/email-campaigns/reports?page=${page}`, {
      signal: controller.signal,
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        setCampaigns(d.campaigns);
        setTotal(d.total);
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          setError("Impossibile caricare lo storico.");
      });
    return () => controller.abort();
  }, [page, revision]);
  async function open(id: string) {
    const gen = ++generation.current;
    setLoading(true);
    setError("");
    setReport(null);
    setSelected([]);
    setConfirm(false);
    setRowPage(1);
    setFilter("");
    setSearch("");
    try {
      const r = await fetch(`/api/email-campaigns/reports?campaign=${id}`);
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      if (gen === generation.current) {
        setReport(d);
        setTimeout(() => detail.current?.focus(), 0);
      }
    } catch (e) {
      if (gen === generation.current)
        setError(e instanceof Error ? e.message : "Report non disponibile.");
    } finally {
      if (gen === generation.current) setLoading(false);
    }
  }
  async function retry() {
    if (!report || sending) return;
    setSending(true);
    setError("");
    try {
      const r = await fetch("/api/email-campaigns/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: report.campaign.id,
          recipientIds: selected,
          confirm: true,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setNotice(
        "Reinvio accodato. Il report originale conserva il collegamento alla nuova campagna.",
      );
      setConfirm(false);
      setRevision((n) => n + 1);
      await open(d.campaignId);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Esito incerto: aggiorna il report prima di riprovare.",
      );
    } finally {
      setSending(false);
    }
  }
  const filtered =
    report?.recipients.filter(
      (r) =>
        (!filter || r.code === filter) &&
        `${r.name} ${r.email}`.toLowerCase().includes(search.toLowerCase()),
    ) || [];
  const pages = Math.max(1, Math.ceil(filtered.length / 100));
  const visible = filtered.slice(
    (Math.min(rowPage, pages) - 1) * 100,
    Math.min(rowPage, pages) * 100,
  );
  return (
    <section className="surface-card w-full min-w-0 max-w-full p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold">Campagne inviate</h3>
        <button
          className="btn-secondary"
          disabled={sending}
          onClick={() => setRevision((n) => n + 1)}
        >
          Aggiorna elenco
        </button>
      </div>
      <p className="mt-2 text-sm">
        Consulta l’esito di ogni destinatario. La consegna al server non
        garantisce lettura o arrivo nella posta principale.
      </p>
      {error && (
        <p role="alert" className="status-error my-3 p-3">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="my-3 p-3">
          {notice}
        </p>
      )}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th>Campagna</th>
              <th>Destinatari</th>
              <th>Data (Roma)</th>
              <th>Report</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className="border-b border-[var(--peace-border)]">
                <td className="py-3 pr-3">{c.name}</td>
                <td>{c.recipientCount}</td>
                <td className="whitespace-nowrap pr-3">{date(c.date)}</td>
                <td>
                  <button
                    className="btn-secondary"
                    disabled={sending || loading}
                    onClick={() => open(c.id)}
                  >
                    Dettagli
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!campaigns.length && <p className="mt-3">Nessuna campagna caricata.</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          className="btn-secondary"
          disabled={page <= 1 || sending}
          onClick={() => setPage(page - 1)}
        >
          Precedenti
        </button>
        <span>
          Pagina {page} di {Math.max(1, Math.ceil(total / 20))}
        </span>
        <button
          className="btn-secondary"
          disabled={page * 20 >= total || sending}
          onClick={() => setPage(page + 1)}
        >
          Successive
        </button>
      </div>
      {loading && (
        <p role="status" className="mt-5">
          Caricamento del report…
        </p>
      )}
      {report && (
        <div
          ref={detail}
          tabIndex={-1}
          className="mt-6 border-t border-[var(--peace-border)] pt-5"
        >
          <h4 className="font-bold">
            {report.campaign.name} · {date(report.campaign.date)}
          </h4>
          <div className="my-3 flex flex-wrap gap-2">
            {Object.entries(report.counts).map(([key, n]) => (
              <span key={key} className="rounded border px-3 py-2 text-sm">
                {labels[key] || key}: <strong>{n}</strong>
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              className="btn-secondary"
              disabled={sending}
              onClick={() => open(report.campaign.id)}
            >
              Aggiorna report
            </button>
            <a
              className="btn-secondary"
              href={`/api/email-campaigns/reports?campaign=${report.campaign.id}&format=csv`}
            >
              Esporta CSV completo
            </a>
            {report.campaign.parent && (
              <button
                className="btn-secondary"
                disabled={sending}
                onClick={() => open(report.campaign.parent!)}
              >
                Campagna originale
              </button>
            )}
          </div>
          <p className="my-3 text-sm">
            Per lo storico senza indirizzo salvato viene indicato il contatto
            attuale, che potrebbe essere cambiato. I destinatari esclusi non
            sono invii falliti.
          </p>
          <div className="flex flex-wrap gap-3">
            <label className="min-w-0 max-w-full">
              Cerca nome o email
              <input
                className="field block max-w-full"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setRowPage(1);
                }}
              />
            </label>
            <label className="min-w-0 max-w-full">
              Esito
              <select
                className="field block max-w-full"
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setRowPage(1);
                }}
              >
                <option value="">Tutti</option>
                {Object.entries(labels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full sm:min-w-[42rem] text-left text-sm">
              <thead>
                <tr>
                  <th>Reinvio</th>
                  <th>Destinatario</th>
                  <th className="hidden sm:table-cell">Esito</th>
                  <th className="hidden sm:table-cell">Data</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-[var(--peace-border)]"
                  >
                    <td className="py-3 pr-3">
                      {r.retryable ? (
                        <input
                          type="checkbox"
                          aria-label={`Seleziona ${r.name} per il reinvio`}
                          disabled={sending || confirm}
                          checked={selected.includes(r.id)}
                          onChange={(e) =>
                            setSelected(
                              e.target.checked
                                ? [...selected, r.id]
                                : selected.filter((id) => id !== r.id),
                            )
                          }
                        />
                      ) : r.retryCampaignId ? (
                        <button
                          className="underline"
                          disabled={sending}
                          onClick={() => open(r.retryCampaignId!)}
                        >
                          Vedi reinvio
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      <strong>{r.name}</strong>
                      <div className="break-all">{r.email || "Indirizzo non disponibile"}</div>
                      <div className="mt-1 sm:hidden"><strong>{r.label}</strong>{r.reason && <p className="break-words text-xs">{r.reason}</p>}<p className="text-xs">{date(r.deliveredAt || r.sentAt)}</p></div>
                      {!r.snapshot && (
                        <small>Contatto attuale, non storico</small>
                      )}
                    </td>
                    <td className="hidden py-3 pr-3 sm:table-cell">
                      {r.label}
                      {r.reason && (
                        <p className="max-w-sm break-words text-xs">
                          {r.reason}
                        </p>
                      )}
                    </td>
                    <td className="hidden sm:table-cell">{date(r.deliveredAt || r.sentAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!visible.length && (
            <p className="my-3">Nessun destinatario corrispondente.</p>
          )}
          <div className="my-3 flex flex-wrap items-center gap-3">
            <button
              className="btn-secondary"
              disabled={rowPage <= 1}
              onClick={() => setRowPage(rowPage - 1)}
            >
              Destinatari precedenti
            </button>
            <span>
              {filtered.length} destinatari · pagina {Math.min(rowPage, pages)}{" "}
              di {pages}
            </span>
            <button
              className="btn-secondary"
              disabled={rowPage >= pages}
              onClick={() => setRowPage(rowPage + 1)}
            >
              Destinatari successivi
            </button>
          </div>
          <p className="text-sm">
            Sono selezionabili solo i fallimenti recuperabili, senza consegna
            confermata, blocchi o reinvii già avviati. Gli esiti incerti
            richiedono verifica.
          </p>
          {!confirm ? (
            <button
              className="btn-secondary mt-3"
              disabled={!selected.length || sending}
              onClick={() => setConfirm(true)}
            >
              Prepara reinvio ({selected.length})
            </button>
          ) : (
            <div className="mt-3 rounded border border-amber-400 bg-amber-50 p-4">
              <p className="font-bold">
                Confermi l’invio dello stesso messaggio e degli stessi allegati
                a queste {selected.length} persone?
              </p>
              <ul className="my-3">
                {report.recipients
                  .filter((r) => selected.includes(r.id))
                  .map((r) => (
                    <li key={r.id}>
                      {r.name} — {r.email}
                    </li>
                  ))}
              </ul>
              <div className="flex gap-3">
                <ProgressButton
                  className="btn-primary"
                  aria-busy={sending}
                  disabled={sending}
                  onClick={retry}
                >
                  Conferma reinvio
                </ProgressButton>
                <button
                  className="btn-secondary"
                  disabled={sending}
                  onClick={() => setConfirm(false)}
                >
                  Annulla
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
