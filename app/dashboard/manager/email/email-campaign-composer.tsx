"use client";

import { Eye, FileText, History, Image as ImageIcon, Mail, Paperclip, Plus, Save, Send, Trash2, Users, X } from "lucide-react";
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
type RecipientRow = {
  participantId: string;
  fullName: string;
  destinationEmail: string;
  deliveryKind: "direct" | "delegated";
  selected: boolean;
};
type AttachmentDraft = {
  id: string;
  file: File;
  inline: boolean;
};
type Preview = {
  campaignId: string;
  recipientCount: number;
  directCount: number;
  delegatedCount: number;
  confirmation: string;
  previewSubject: string;
  previewHtml: string;
  recipients: RecipientRow[];
  attachments: Array<{
    fileName: string;
    contentType: string;
    sizeBytes: number;
    inline: boolean;
  }>;
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
  const [recipientRows, setRecipientRows] = useState<RecipientRow[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
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
  const selectedRecipientIdSet = useMemo(
    () => new Set(selectedRecipientIds),
    [selectedRecipientIds]
  );
  const selectedDirectCount = useMemo(
    () => recipientRows.filter((recipient) => selectedRecipientIdSet.has(recipient.participantId) && recipient.deliveryKind === "direct").length,
    [recipientRows, selectedRecipientIdSet]
  );
  const selectedDelegatedCount = selectedRecipientIds.length - selectedDirectCount;

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

  function resetRecipients() {
    setRecipientRows([]);
    setSelectedRecipientIds([]);
    resetPreview();
  }

  async function loadRecipients() {
    const data = await callCampaign({
      action: "recipients",
      groupId: groupId || null,
      tagId: tagId || null,
      status,
    });
    if (data) {
      setRecipientRows(data.recipients);
      setSelectedRecipientIds(
        data.recipients.map((recipient: RecipientRow) => recipient.participantId)
      );
      setPreview(null);
    }
  }

  async function createPreview() {
    if (!recipientRows.length || !selectedRecipientIds.length) {
      setError("Prima mostra l’elenco e seleziona almeno un destinatario.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const formData = new FormData();
      formData.set("action", "preview");
      formData.set("templateId", templateId);
      formData.set("name", name);
      formData.set("subject", subject);
      formData.set("message", message);
      formData.set("groupId", groupId);
      formData.set("tagId", tagId);
      formData.set("status", status);
      formData.set("selectedParticipantIds", JSON.stringify(selectedRecipientIds));
      formData.set(
        "inlineAttachmentIndexes",
        JSON.stringify(attachments.flatMap((attachment, index) => attachment.inline ? [String(index)] : []))
      );
      for (const attachment of attachments) formData.append("attachments", attachment.file);
      const response = await fetch("/api/email-campaigns", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Operazione non riuscita.");
      setPreview(data);
      setSelectedRecipientIds(
        data.recipients
          .filter((recipient: RecipientRow) => recipient.selected)
          .map((recipient: RecipientRow) => recipient.participantId)
      );
      setConfirmation("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operazione non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  function toggleRecipient(participantId: string) {
    setSelectedRecipientIds((current) => current.includes(participantId)
      ? current.filter((id) => id !== participantId)
      : [...current, participantId]
    );
    setPreview(null);
    setConfirmation("");
    setNotice("");
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
      resetPreview();
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
      setNotice(selectedTemplate ? "Modello aggiornato." : "Modello salvato per usi futuri.");
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
              Segui i passaggi nell’ordine: prepara il messaggio, controlla chi lo
              riceverà, aggiungi eventuali file e invia prima una prova.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-[var(--peace-sky-100)] px-3 py-1.5 text-xs font-bold text-[var(--peace-blue-800)]">
            <Mail aria-hidden="true" className="h-4 w-4" />
            Test obbligatorio prima dell’invio
          </div>
        </div>
        <ol className="mt-5 grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
          {["Scrivi il messaggio", "Scegli i destinatari", "Aggiungi file", "Controlla e invia"].map((step, index) => (
            <li key={step} className="flex items-center gap-2 rounded-md bg-[#f7fbfe] px-3 py-2 font-semibold">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--peace-blue-700)] text-xs text-white">{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </section>

      {error ? <p className="status-error">{error}</p> : null}
      {notice ? <p className="status-success">{notice}</p> : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(17rem,1fr)]">
        <section className="surface-card grid gap-5 p-5 sm:p-6">
          <div>
            <p className="eyebrow">Passaggio 1</p>
            <h3 className="mt-1 text-lg font-bold">Scrivi il messaggio</h3>
            <p className="mt-1 text-sm text-[var(--peace-muted)]">
              Il titolo interno ti aiuta a ritrovare la campagna e non sarà mostrato ai destinatari.
            </p>
          </div>

          <label className="grid gap-1 text-sm font-semibold">
            Titolo interno
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
                <h3 className="font-bold">Modelli riutilizzabili</h3>
                <p className="mt-1 text-xs text-[var(--peace-muted)]">
                  Facoltativo: carica un messaggio già preparato.
                </p>
              </div>
              <button
                type="button"
                className="grid min-h-9 min-w-9 place-items-center rounded border border-[var(--peace-border)] hover:bg-[var(--peace-sky-100)]"
                aria-label="Nuovo messaggio vuoto"
                title="Nuovo messaggio vuoto"
                onClick={startNewTemplate}
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
            {savedTemplates.length === 0 ? (
              <p className="mt-4 rounded-md bg-[#f7fbfe] p-3 text-sm text-[var(--peace-muted)]">
                Nessun modello salvato.
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
                      {template.subject}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-4 border-t border-[var(--peace-border)] pt-4">
              <p className="text-xs text-[var(--peace-muted)]">
                Salva il testo corrente solo se pensi di riutilizzarlo in altre campagne.
              </p>
              <button
                type="button"
                className="btn-secondary mt-3 w-full"
                disabled={busy}
                onClick={saveTemplate}
              >
                <Save aria-hidden="true" className="h-4 w-4" />
                {selectedTemplate ? "Aggiorna questo modello" : "Salva come modello"}
              </button>
            </div>
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
            <p className="eyebrow">Passaggio 2</p>
            <div className="flex items-center gap-2">
              <Users aria-hidden="true" className="h-5 w-5" />
              <h3 className="text-lg font-bold">Scegli i destinatari</h3>
            </div>
            <p className="mt-1 text-sm text-[var(--peace-muted)]">
              Applica i filtri, mostra l’elenco e deseleziona le persone che non
              devono ricevere questa campagna.
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
                resetRecipients();
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
                resetRecipients();
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
                resetRecipients();
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--peace-muted)]">
            Chi non ha un’email può ricevere il messaggio tramite il proprio referente.
          </p>
          <button type="button" className="btn-primary" disabled={busy} onClick={loadRecipients}>
            <Users aria-hidden="true" className="h-4 w-4" />
            Mostra l’elenco
          </button>
        </div>
        {recipientRows.length ? (
          <div className="rounded-md border border-[var(--peace-border)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-bold">Elenco destinatari</p>
                <p className="mt-1 text-sm text-[var(--peace-muted)]">
                  {selectedRecipientIds.length} selezionati: {selectedDirectCount} diretti e {selectedDelegatedCount} tramite referente.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-secondary px-3 py-2 text-xs"
                  onClick={() => {
                    setSelectedRecipientIds(recipientRows.map((recipient) => recipient.participantId));
                    resetPreview();
                  }}
                >
                  Seleziona tutti
                </button>
                <button
                  type="button"
                  className="btn-secondary px-3 py-2 text-xs"
                  onClick={() => {
                    setSelectedRecipientIds([]);
                    resetPreview();
                  }}
                >
                  Deseleziona tutti
                </button>
              </div>
            </div>
            <div className="mt-4 max-h-80 overflow-y-auto rounded-md border border-[var(--peace-border)]">
              {recipientRows.map((recipient) => (
                <label
                  key={recipient.participantId}
                  className="flex cursor-pointer items-start gap-3 border-b border-[var(--peace-border)] px-3 py-3 last:border-0 hover:bg-[#f7fbfe]"
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-[var(--peace-blue-700)]"
                    checked={selectedRecipientIdSet.has(recipient.participantId)}
                    onChange={() => toggleRecipient(recipient.participantId)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{recipient.fullName}</span>
                    <span className="block truncate text-xs text-[var(--peace-muted)]">
                      {recipient.destinationEmail}
                    </span>
                  </span>
                  <span className="rounded-full bg-[var(--peace-sky-100)] px-2 py-1 text-[0.7rem] font-bold text-[var(--peace-blue-800)]">
                    {recipient.deliveryKind === "direct" ? "Diretta" : "Tramite referente"}
                  </span>
                </label>
              ))}
            </div>
            {selectedRecipientIds.length === 0 ? (
              <p className="mt-3 text-sm font-semibold text-[var(--peace-danger)]">
                Seleziona almeno un destinatario per continuare.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="rounded-md bg-[#f7fbfe] p-4 text-sm text-[var(--peace-muted)]">
            L’elenco comparirà qui prima dell’anteprima finale.
          </p>
        )}
      </section>

      <section className="surface-card grid gap-5 p-5 sm:p-6">
        <div>
          <p className="eyebrow">Passaggio 3 · facoltativo</p>
          <div className="flex items-center gap-2">
            <Paperclip aria-hidden="true" className="h-5 w-5" />
            <h3 className="text-lg font-bold">Aggiungi file o immagini</h3>
          </div>
          <p className="mt-1 text-sm text-[var(--peace-muted)]">
            Fino a 5 file, massimo 5 MB ciascuno e 10 MB complessivi. Le immagini possono essere mostrate anche nel corpo dell’email.
          </p>
        </div>
        <label className="grid max-w-xl gap-2 text-sm font-semibold">
          Scegli file
          <input
            type="file"
            className="field font-normal file:mr-3 file:rounded file:border-0 file:bg-[var(--peace-sky-100)] file:px-3 file:py-2 file:font-semibold file:text-[var(--peace-blue-800)]"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,image/jpeg,image/png,image/gif,image/webp"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              setAttachments((current) => [
                ...current,
                ...files.map((file) => ({ id: crypto.randomUUID(), file, inline: false })),
              ].slice(0, 5));
              resetPreview();
              event.target.value = "";
            }}
          />
        </label>
        {attachments.length ? (
          <div className="grid gap-2">
            {attachments.map((attachment) => {
              const isImage = attachment.file.type.startsWith("image/");
              return (
                <div key={attachment.id} className="flex flex-wrap items-center gap-3 rounded-md border border-[var(--peace-border)] p-3">
                  {isImage ? <ImageIcon aria-hidden="true" className="h-5 w-5" /> : <FileText aria-hidden="true" className="h-5 w-5" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{attachment.file.name}</p>
                    <p className="text-xs text-[var(--peace-muted)]">{formatFileSize(attachment.file.size)}</p>
                  </div>
                  {isImage ? (
                    <label className="flex items-center gap-2 text-xs font-semibold">
                      <input
                        type="checkbox"
                        checked={attachment.inline}
                        onChange={(event) => {
                          setAttachments((current) => current.map((item) => item.id === attachment.id ? { ...item, inline: event.target.checked } : item));
                          resetPreview();
                        }}
                      />
                      Mostra nel corpo dell’email
                    </label>
                  ) : null}
                  <button
                    type="button"
                    className="grid min-h-9 min-w-9 place-items-center rounded border border-[var(--peace-border)]"
                    aria-label={`Rimuovi ${attachment.file.name}`}
                    onClick={() => {
                      setAttachments((current) => current.filter((item) => item.id !== attachment.id));
                      resetPreview();
                    }}
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="rounded-md bg-[#f7fbfe] p-4 text-sm text-[var(--peace-muted)]">Nessun file allegato.</p>
        )}
      </section>

      <section className="surface-card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div>
          <p className="eyebrow">Passaggio 4</p>
          <h3 className="mt-1 text-lg font-bold">Controlla e prepara l’invio</h3>
          <p className="mt-1 text-sm text-[var(--peace-muted)]">
            L’anteprima congela messaggio, destinatari e allegati. Poi dovrai inviare una prova prima dell’invio definitivo.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={busy || selectedRecipientIds.length === 0}
          onClick={createPreview}
        >
          <Eye aria-hidden="true" className="h-4 w-4" />
          Controlla anteprima
        </button>
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
              <button type="button" className="grid min-h-9 min-w-9 place-items-center rounded border border-[var(--peace-border)]" aria-label="Chiudi anteprima" onClick={resetPreview}>
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--peace-muted)]">Oggetto</p>
              <p className="mt-1 font-bold">{preview.previewSubject}</p>
              <p className="mt-4 text-xs font-bold uppercase tracking-wide text-[var(--peace-muted)]">Messaggio</p>
              <div className="mt-2 rounded bg-white p-4 text-sm [&_h2]:text-xl [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6" dangerouslySetInnerHTML={{ __html: preview.previewHtml }} />
              <p className="mt-4 text-xs font-bold uppercase tracking-wide text-[var(--peace-muted)]">File e immagini</p>
              {preview.attachments.length ? (
                <ul className="mt-2 grid gap-2">
                  {preview.attachments.map((attachment) => (
                    <li key={`${attachment.fileName}-${attachment.sizeBytes}`} className="flex items-center gap-2 rounded bg-white px-3 py-2 text-sm">
                      {attachment.inline ? <ImageIcon aria-hidden="true" className="h-4 w-4" /> : <Paperclip aria-hidden="true" className="h-4 w-4" />}
                      <span className="min-w-0 flex-1 truncate">{attachment.fileName}</span>
                      <span className="text-xs text-[var(--peace-muted)]">
                        {attachment.inline ? "Nel messaggio" : "Allegato"} · {formatFileSize(attachment.sizeBytes)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-[var(--peace-muted)]">Nessun file allegato.</p>
              )}
            </div>
            <div className="mt-5 grid gap-4 rounded-md border border-[var(--peace-border)] p-4">
              <p className="text-sm text-[var(--peace-muted)]">
                La prova usa i dati del primo destinatario per controllare campi personalizzati, immagini e allegati.
              </p>
              <button type="button" className="btn-secondary justify-self-start" disabled={busy} onClick={sendTest}>
                <Send aria-hidden="true" className="h-4 w-4" />
                1. Invia l’email di prova al mio indirizzo
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

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
