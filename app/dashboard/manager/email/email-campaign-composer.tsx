"use client";

import { Eye, FileText, History, Mail, Plus, Save, Send, Users, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { CAMPAIGN_TEMPLATE_FIELDS } from "@/lib/email/campaign-templates";
import { CampaignRichTextEditor } from "./campaign-rich-text-editor";

type Option = { id: string; label: string };
type Template = {
  id: string;
  name: string;
  subject: string;
  bodyText: string;
  version: number;
};
type CampaignSummary = {
  id: string;
  name: string;
  status: string;
  recipientCount: number;
  date: string;
};
type Preview = {
  campaignId: string;
  recipientCount: number;
  directCount: number;
  delegatedCount: number;
  confirmation: string;
  previewSubject: string;
  previewHtml: string;
};

type EmailCampaignComposerProps = {
  groups: Option[];
  tags: Option[];
  templates: Template[];
  campaigns: CampaignSummary[];
};

export function EmailCampaignComposer({
  groups,
  tags,
  templates: initialTemplates,
  campaigns,
}: EmailCampaignComposerProps) {
  const [savedTemplates, setSavedTemplates] = useState(initialTemplates);
  const [templateId, setTemplateId] = useState("");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("<p></p>");
  const [tokenToInsert, setTokenToInsert] = useState<string | null>(null);
  const [groupId, setGroupId] = useState("");
  const [tagId, setTagId] = useState("");
  const [status, setStatus] = useState("active");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedTemplate = useMemo(
    () => savedTemplates.find((item) => item.id === templateId),
    [savedTemplates, templateId]
  );

  const resetPreview = useCallback(() => setPreview(null), []);
  const clearPendingToken = useCallback(() => setTokenToInsert(null), []);

  function startNewTemplate() {
    setTemplateId("");
    setName("");
    setSubject("");
    setMessage("<p></p>");
    setPreview(null);
  }

  function loadTemplate(template: Template) {
    setTemplateId(template.id);
    setName(template.name);
    setSubject(template.subject);
    setMessage(template.bodyText);
    setPreview(null);
  }

  async function callCampaign(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/email-campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Operazione non riuscita.");
      return data;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operazione non riuscita.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function createPreview() {
    const data = await callCampaign({
      action: "preview",
      templateId: templateId || null,
      name,
      subject,
      message,
      groupId: groupId || null,
      tagId: tagId || null,
      status,
    });
    if (data) {
      setPreview(data);
      setConfirmation("");
    }
  }

  async function sendTest() {
    if (!preview) return;
    const data = await callCampaign({ action: "test", campaignId: preview.campaignId });
    if (data) {
      setNotice("Email test inviata al tuo indirizzo. Controllala prima di procedere.");
    }
  }

  async function sendCampaign() {
    if (!preview) return;
    const data = await callCampaign({
      action: "send",
      campaignId: preview.campaignId,
      confirmation,
    });
    if (data) {
      setNotice(`Invio concluso: ${data.sent} riuscite, ${data.failed} non riuscite.`);
      setPreview(null);
    }
  }

  async function saveTemplate() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/email-templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: selectedTemplate?.id, name, subject, message }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Salvataggio non riuscito.");

      const updatedTemplate: Template = {
        id: data.id,
        name,
        subject,
        bodyText: message,
        version: data.version,
      };
      setSavedTemplates((current) => [
        updatedTemplate,
        ...current.filter((item) => item.id !== updatedTemplate.id),
      ]);
      setTemplateId(updatedTemplate.id);
      setNotice(`Template salvato come versione ${data.version}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Salvataggio non riuscito.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      <section className="surface-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Comunicazioni</p>
            <h2 className="mt-1 text-2xl font-bold">Campagne email</h2>
            <p className="mt-2 max-w-3xl text-sm text-[var(--peace-muted)]">
              Componi un messaggio personalizzato, scegli i destinatari e controlla
              l’anteprima prima dell’invio.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-[var(--peace-sky-100)] px-3 py-1.5 text-xs font-bold text-[var(--peace-blue-800)]">
            <Mail aria-hidden="true" className="h-4 w-4" />
            Test obbligatorio prima dell’invio
          </div>
        </div>
      </section>

      {error ? <p className="status-error">{error}</p> : null}
      {notice ? <p className="status-success">{notice}</p> : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(17rem,1fr)]">
        <section className="surface-card grid gap-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold">Componi il messaggio</h3>
              <p className="mt-1 text-sm text-[var(--peace-muted)]">
                Il nome operativo serve solo a riconoscere template e campagne.
              </p>
            </div>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={saveTemplate}
            >
              <Save aria-hidden="true" className="h-4 w-4" />
              {selectedTemplate ? "Salva nuova versione" : "Salva template"}
            </button>
          </div>

          <label className="grid gap-1 text-sm font-semibold">
            Nome operativo
            <input
              className="field font-normal"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                resetPreview();
              }}
              maxLength={120}
              placeholder="Es. Informazioni pratiche di ottobre"
              autoComplete="off"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Oggetto
            <input
              className="field font-normal"
              value={subject}
              onChange={(event) => {
                setSubject(event.target.value);
                resetPreview();
              }}
              maxLength={180}
              placeholder="Oggetto dell’email"
            />
          </label>
          <div className="grid gap-1">
            <span className="text-sm font-semibold">Messaggio</span>
            <CampaignRichTextEditor
              value={message}
              onChange={(html) => {
                setMessage(html);
                resetPreview();
              }}
              tokenToInsert={tokenToInsert}
              onTokenInserted={clearPendingToken}
            />
          </div>
        </section>

        <aside className="grid gap-6 xl:sticky xl:top-24">
          <section className="surface-card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold">Template salvati</h3>
                <p className="mt-1 text-xs text-[var(--peace-muted)]">
                  Seleziona un modello da riutilizzare.
                </p>
              </div>
              <button
                type="button"
                className="grid min-h-9 min-w-9 place-items-center rounded border border-[var(--peace-border)] hover:bg-[var(--peace-sky-100)]"
                aria-label="Nuovo template"
                title="Nuovo template"
                onClick={startNewTemplate}
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
            {savedTemplates.length === 0 ? (
              <p className="mt-4 rounded-md bg-[#f7fbfe] p-3 text-sm text-[var(--peace-muted)]">
                Nessun template salvato.
              </p>
            ) : (
              <div className="mt-4 grid gap-2">
                {savedTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className={[
                      "rounded-md border p-3 text-left transition",
                      template.id === templateId
                        ? "border-[var(--peace-blue-700)] bg-[var(--peace-sky-100)]"
                        : "border-[var(--peace-border)] hover:bg-[#f7fbfe]",
                    ].join(" ")}
                    onClick={() => loadTemplate(template)}
                  >
                    <span className="flex items-center gap-2 text-sm font-bold">
                      <FileText aria-hidden="true" className="h-4 w-4" />
                      {template.name}
                    </span>
                    <span className="mt-1 block truncate text-xs text-[var(--peace-muted)]">
                      v{template.version} · {template.subject}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="surface-card p-5">
            <h3 className="font-bold">Campi personalizzati</h3>
            <p className="mt-1 text-xs text-[var(--peace-muted)]">
              Inserisci il campo nella posizione corrente del cursore.
            </p>
            <div className="mt-4 grid gap-2">
              {CAMPAIGN_TEMPLATE_FIELDS.map((field) => (
                <button
                  key={field.token}
                  type="button"
                  className="flex items-center justify-between gap-3 rounded-md border border-[var(--peace-border)] px-3 py-2.5 text-left hover:bg-[#f7fbfe]"
                  onClick={() => setTokenToInsert(field.token)}
                >
                  <span className="text-sm font-semibold">{field.label}</span>
                  <code className="text-xs text-[var(--peace-muted)]">{field.token}</code>
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <section className="surface-card grid gap-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Users aria-hidden="true" className="h-5 w-5" />
              <h3 className="text-lg font-bold">Destinatari</h3>
            </div>
            <p className="mt-1 text-sm text-[var(--peace-muted)]">
              I filtri vengono applicati all’evento corrente. Chi non ha email può
              ricevere il messaggio tramite il proprio referente.
            </p>
          </div>
          <span className="rounded-full border border-[var(--peace-border)] px-3 py-1 text-xs font-bold">
            Massimo 100 destinatari
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-1 text-sm font-semibold">
            Gruppo
            <select
              className="field font-normal"
              value={groupId}
              onChange={(event) => {
                setGroupId(event.target.value);
                resetPreview();
              }}
            >
              <option value="">Tutti i gruppi</option>
              {groups.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Tag operativo
            <select
              className="field font-normal"
              value={tagId}
              onChange={(event) => {
                setTagId(event.target.value);
                resetPreview();
              }}
            >
              <option value="">Tutti i tag</option>
              {tags.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Stato iscrizione
            <select
              className="field font-normal"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                resetPreview();
              }}
            >
              <option value="active">Iscrizioni attive</option>
              <option value="submitted">Inviate</option>
              <option value="confirmed">Confermate</option>
              <option value="cancelled">Annullate</option>
              <option value="all">Tutte</option>
            </select>
          </label>
        </div>
        <div className="flex justify-end">
          <button type="button" className="btn-primary" disabled={busy} onClick={createPreview}>
            <Eye aria-hidden="true" className="h-4 w-4" />
            Anteprima destinatari e messaggio
          </button>
        </div>
      </section>

      <section className="surface-card p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <History aria-hidden="true" className="h-5 w-5" />
          <h3 className="text-lg font-bold">Attività recente</h3>
        </div>
        {campaigns.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--peace-muted)]">Nessuna campagna preparata.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="border-b border-[var(--peace-border)] text-xs uppercase tracking-wide text-[var(--peace-muted)]">
                <tr><th className="py-2 pr-4">Campagna</th><th className="py-2 pr-4">Stato</th><th className="py-2 pr-4">Destinatari</th><th className="py-2">Data</th></tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr key={campaign.id} className="border-b border-[var(--peace-border)] last:border-0">
                    <td className="py-3 pr-4 font-semibold">{campaign.name}</td>
                    <td className="py-3 pr-4">{campaignStatusLabel(campaign.status)}</td>
                    <td className="py-3 pr-4">{campaign.recipientCount}</td>
                    <td className="py-3">{formatCampaignDate(campaign.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {preview ? (
        <div className="dashboard-modal fixed inset-0 z-50 grid place-items-center bg-[#072c49]/55 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="campaign-preview-title"
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[var(--radius-lg)] bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="campaign-preview-title" className="text-xl font-bold">Anteprima prima dell’invio</h3>
                <p className="mt-1 text-sm text-[var(--peace-muted)]">
                  {preview.recipientCount} destinatari: {preview.directCount} diretti e {preview.delegatedCount} tramite referente.
                </p>
              </div>
              <button type="button" className="grid min-h-9 min-w-9 place-items-center rounded border border-[var(--peace-border)]" aria-label="Chiudi anteprima" onClick={() => setPreview(null)}>
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--peace-muted)]">Oggetto</p>
              <p className="mt-1 font-bold">{preview.previewSubject}</p>
              <p className="mt-4 text-xs font-bold uppercase tracking-wide text-[var(--peace-muted)]">Messaggio</p>
              <div className="mt-2 rounded bg-white p-4 text-sm [&_h2]:text-xl [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6" dangerouslySetInnerHTML={{ __html: preview.previewHtml }} />
            </div>
            <div className="mt-5 grid gap-4 rounded-md border border-[var(--peace-border)] p-4">
              <button type="button" className="btn-secondary justify-self-start" disabled={busy} onClick={sendTest}>
                <Send aria-hidden="true" className="h-4 w-4" />
                1. Invia test al mio indirizzo
              </button>
              <label className="grid max-w-md gap-1 text-sm font-semibold">
                2. Dopo aver controllato il test, digita “{preview.confirmation}”
                <input className="field font-normal" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" />
              </label>
              <button type="button" className="btn-primary justify-self-start" disabled={busy || confirmation !== preview.confirmation} onClick={sendCampaign}>
                <Mail aria-hidden="true" className="h-4 w-4" />
                3. Invia la campagna
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function campaignStatusLabel(status: string) {
  switch (status) {
    case "completed": return "Completata";
    case "partial": return "Parziale";
    case "failed": return "Non riuscita";
    case "sending": return "In invio";
    case "ready": return "Test inviato";
    default: return "Bozza";
  }
}

function formatCampaignDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
