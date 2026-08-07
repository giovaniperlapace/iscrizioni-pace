"use client";

import { Eye, FileText, History, Image as ImageIcon, Mail, Paperclip, Plus, Save, Send, Trash2, Users, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  recipientKey: string;
  recipientType: "participant" | "group_leader" | "teacher";
  fullName: string;
  destinationEmail: string;
  deliveryKind: "direct" | "delegated" | "leader" | "teacher";
  selected: boolean;
  groupIds: string[];
  tagIds: string[];
  serviceIds: string[];
  panelIds: string[];
  schoolNames: string[];
};
type AttachmentDraft = {
  id: string;
  file: File;
  inline: boolean;
};
type TemplateSaveMode = "create" | "update";
type Preview = {
  campaignId: string;
  recipientCount: number;
  directCount: number;
  delegatedCount: number;
  leaderCount: number;
  teacherCount: number;
  testRecipientEmail: string;
  sampleRecipientName: string;
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
  services: Option[];
  panels: Option[];
  initialPanelId?: string | null;
  initialRecipients: RecipientRow[];
  templates: Template[];
  campaigns: CampaignSummary[];
};

export function EmailCampaignComposer({
  groups,
  tags,
  services,
  panels,
  initialPanelId,
  initialRecipients,
  templates: initialTemplates,
  campaigns,
}: EmailCampaignComposerProps) {
  const [savedTemplates, setSavedTemplates] = useState(initialTemplates);
  const [templateId, setTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateSaveError, setTemplateSaveError] = useState("");
  const [templateSaveMode, setTemplateSaveMode] = useState<TemplateSaveMode>("create");
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showTemplateSave, setShowTemplateSave] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("<p></p>");
  const [tokenToInsert, setTokenToInsert] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [panelFilter, setPanelFilter] = useState(
    () => panels.find((panel) => panel.id === initialPanelId)?.label ?? ""
  );
  const [schoolFilter, setSchoolFilter] = useState("");
  const [groupMembershipFilter, setGroupMembershipFilter] = useState<
    "all" | "with_group" | "without_group"
  >("all");
  const [audience, setAudience] = useState<"participants" | "group_leaders" | "teachers">(
    "participants"
  );
  const [recipientSearch, setRecipientSearch] = useState("");
  const recipientRows = initialRecipients;
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [testSent, setTestSent] = useState(false);
  const [showSendConfirmation, setShowSendConfirmation] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const selectFilteredCheckboxRef = useRef<HTMLInputElement>(null);

  const selectedTemplate = useMemo(
    () => savedTemplates.find((item) => item.id === templateId),
    [savedTemplates, templateId]
  );
  const groupLabelById = useMemo(
    () => new Map(groups.map((group) => [group.id, group.label])),
    [groups]
  );
  const panelLabelById = useMemo(
    () => new Map(panels.map((panel) => [panel.id, panel.label])),
    [panels]
  );

  const resetPreview = useCallback(() => {
    setPreview(null);
    setTestSent(false);
    setShowSendConfirmation(false);
  }, []);
  const clearPendingToken = useCallback(() => setTokenToInsert(null), []);
  const selectedRecipientIdSet = useMemo(
    () => new Set(selectedRecipientIds),
    [selectedRecipientIds]
  );
  const filteredRecipientRows = useMemo(() => {
    const groupIds = matchingOptionIds(groups, groupFilter);
    const tagIds = matchingOptionIds(tags, tagFilter);
    const serviceIds = matchingOptionIds(services, serviceFilter);
    const panelIds = matchingOptionIds(panels, panelFilter);
    const search = normalizeRecipientSearch(recipientSearch);
    const schoolSearch = normalizeRecipientSearch(schoolFilter);

    return recipientRows.filter((recipient) =>
      (audience === "participants"
        ? recipient.recipientType === "participant"
        : audience === "group_leaders"
          ? recipient.recipientType === "group_leader"
          : recipient.recipientType === "teacher") &&
      (audience === "teachers" || !groupFilter || recipient.groupIds.some((id) => groupIds.has(id))) &&
      (audience === "group_leaders" ||
        groupMembershipFilter === "all" ||
        (groupMembershipFilter === "with_group" && recipient.groupIds.length > 0) ||
        (groupMembershipFilter === "without_group" && recipient.groupIds.length === 0)) &&
      (audience === "group_leaders" ||
        audience === "teachers" ||
        !tagFilter ||
        recipient.tagIds.some((id) => tagIds.has(id))) &&
      (audience === "group_leaders" ||
        audience === "teachers" ||
        !serviceFilter ||
        recipient.serviceIds.some((id) => serviceIds.has(id))) &&
      (!panelFilter || recipient.panelIds.some((id) => panelIds.has(id))) &&
      (audience !== "teachers" || !schoolFilter || recipient.schoolNames.some((name) => normalizeRecipientSearch(name).includes(schoolSearch))) &&
      (!search || normalizeRecipientSearch(`${recipient.fullName} ${recipient.destinationEmail} ${recipient.schoolNames.join(" ")}`).includes(search))
    );
  }, [audience, groupFilter, groupMembershipFilter, groups, panelFilter, panels, recipientRows, recipientSearch, schoolFilter, serviceFilter, services, tagFilter, tags]);
  const selectedRecipientRows = useMemo(
    () => recipientRows.filter((recipient) =>
      selectedRecipientIdSet.has(recipient.recipientKey)
    ),
    [recipientRows, selectedRecipientIdSet]
  );
  const selectedDirectCount = useMemo(
    () => selectedRecipientRows.filter((recipient) => recipient.deliveryKind === "direct").length,
    [selectedRecipientRows]
  );
  const selectedDelegatedCount = useMemo(
    () =>
      selectedRecipientRows.filter(
        (recipient) => recipient.deliveryKind === "delegated"
      ).length,
    [selectedRecipientRows]
  );
  const filteredSelectedCount = filteredRecipientRows.filter((recipient) =>
    selectedRecipientIdSet.has(recipient.recipientKey)
  ).length;
  const allFilteredSelected =
    filteredRecipientRows.length > 0 &&
    filteredSelectedCount === filteredRecipientRows.length;

  useEffect(() => {
    if (selectFilteredCheckboxRef.current) {
      selectFilteredCheckboxRef.current.indeterminate =
        filteredSelectedCount > 0 && !allFilteredSelected;
    }
  }, [allFilteredSelected, filteredSelectedCount]);

  function startNewTemplate() {
    setTemplateId("");
    setTemplateName("");
    setSubject("");
    setMessage("<p></p>");
    setPreview(null);
    setShowTemplatePicker(false);
  }

  function loadTemplate(template: Template) {
    setTemplateId(template.id);
    setTemplateName(template.name);
    setSubject(template.subject);
    setMessage(template.bodyText);
    setPreview(null);
    setShowTemplatePicker(false);
  }

  function openTemplateSave(mode: TemplateSaveMode) {
    setTemplateSaveMode(mode);
    setTemplateName(mode === "update" ? selectedTemplate?.name ?? "" : "");
    setTemplateSaveError("");
    setShowTemplateSave(true);
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
    if (!recipientRows.length || !selectedRecipientIds.length) {
      setError("Seleziona almeno un destinatario.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const formData = new FormData();
      formData.set("action", "preview");
      formData.set("templateId", templateId);
      formData.set("name", subject.trim());
      formData.set("subject", subject);
      formData.set("message", message);
      formData.set("status", "active");
      formData.set("audience", audience);
      formData.set("panelId", panelFilter);
      formData.set("schoolName", schoolFilter);
      formData.set("selectedRecipientKeys", JSON.stringify(selectedRecipientIds));
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
          .map((recipient: RecipientRow) => recipient.recipientKey)
      );
      setTestSent(false);
      setShowSendConfirmation(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operazione non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  function setRecipientSelected(recipientKey: string, selected: boolean) {
    setSelectedRecipientIds((current) =>
      selected
        ? current.includes(recipientKey)
          ? current
          : [...current, recipientKey]
        : current.filter((key) => key !== recipientKey)
    );
    setPreview(null);
    setTestSent(false);
    setShowSendConfirmation(false);
    setNotice("");
    setError("");
  }

  function setAllFilteredRecipientsSelected(selected: boolean) {
    const filteredKeys = new Set(
      filteredRecipientRows.map((recipient) => recipient.recipientKey)
    );
    setSelectedRecipientIds((current) =>
      selected
        ? [...new Set([...current, ...filteredKeys])]
        : current.filter((key) => !filteredKeys.has(key))
    );
    setPreview(null);
    setTestSent(false);
    setShowSendConfirmation(false);
    setNotice("");
    setError("");
  }

  function changeAudience(nextAudience: "participants" | "group_leaders" | "teachers") {
    if (nextAudience === audience) return;
    setAudience(nextAudience);
    setSelectedRecipientIds([]);
    setRecipientSearch("");
    setGroupFilter("");
    setTagFilter("");
    setServiceFilter("");
    setPanelFilter("");
    setSchoolFilter("");
    setGroupMembershipFilter("all");
    resetPreview();
    setNotice("");
    setError("");
  }

  async function sendTest() {
    if (!preview) return;
    const data = await callCampaign({ action: "test", campaignId: preview.campaignId });
    if (data) {
      setTestSent(true);
    }
  }

  async function sendCampaign() {
    if (!preview) return;
    const data = await callCampaign({
      action: "send",
      campaignId: preview.campaignId,
    });
    if (data) {
      setShowSendConfirmation(false);
      setNotice(
        data.scheduled > 0
          ? `Prima tranche conclusa: ${data.sent} inviate, ${data.failed} non riuscite. ${data.scheduled} email sono programmate per i prossimi giorni, fino a 300 al giorno.`
          : `Invio concluso: ${data.sent} riuscite, ${data.failed} non riuscite.`
      );
      resetPreview();
    }
  }

  async function saveTemplate() {
    const cleanTemplateName = templateName.trim();
    if (!cleanTemplateName) {
      setTemplateSaveError("Inserisci un titolo interno per il modello.");
      return;
    }
    setBusy(true);
    setTemplateSaveError("");
    try {
      const response = await fetch("/api/email-templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: templateSaveMode === "update" ? selectedTemplate?.id : undefined,
          name: cleanTemplateName,
          subject,
          message,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Salvataggio non riuscito.");

      const updatedTemplate: Template = {
        id: data.id,
        name: cleanTemplateName,
        subject,
        bodyText: message,
        version: data.version,
      };
      setSavedTemplates((current) => [
        updatedTemplate,
        ...current.filter((item) => item.id !== updatedTemplate.id),
      ]);
      setTemplateId(updatedTemplate.id);
      setNotice(
        templateSaveMode === "update"
          ? "Modello aggiornato."
          : selectedTemplate
            ? "Nuovo modello salvato. Il modello originale non è stato modificato."
            : "Modello salvato per usi futuri."
      );
      setShowTemplateSave(false);
    } catch (cause) {
      setTemplateSaveError(cause instanceof Error ? cause.message : "Salvataggio non riuscito.");
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
              Segui i passaggi nell’ordine: scrivi il messaggio o parti da un
              modello, controlla chi lo riceverà, aggiungi eventuali file e invia
              prima una prova.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-[var(--peace-sky-100)] px-3 py-1.5 text-xs font-bold text-[var(--peace-blue-800)]">
            <Mail aria-hidden="true" className="h-4 w-4" />
            Test obbligatorio prima dell’invio
          </div>
        </div>
        <ol className="mt-5 grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
          {["Scrivi un messaggio o usa un modello", "Scegli i destinatari", "Aggiungi file", "Controlla e invia"].map((step, index) => (
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
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Passaggio 1</p>
              <h3 className="mt-1 text-lg font-bold">
                Scrivi un messaggio o usa un modello già salvato
              </h3>
              <p className="mt-1 text-sm text-[var(--peace-muted)]">
                Il titolo interno viene richiesto solo quando salvi il contenuto come modello.
              </p>
              {selectedTemplate ? (
                <p className="mt-2 text-xs font-semibold text-[var(--peace-blue-800)]">
                  Modello caricato: {selectedTemplate.name}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              className="btn-secondary inline-flex shrink-0 items-center justify-center gap-2 px-4"
              onClick={() => setShowTemplatePicker(true)}
            >
              <FileText aria-hidden="true" className="h-4 w-4" />
              Usa un modello già salvato
            </button>
          </div>

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
          <div className="flex flex-col gap-3 border-t border-[var(--peace-border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--peace-muted)]">
              Salva oggetto e messaggio come modello solo se pensi di riutilizzarli.
            </p>
            <div className="flex shrink-0 flex-wrap gap-2">
              {selectedTemplate ? (
                <button
                  type="button"
                  className="btn-secondary inline-flex items-center justify-center gap-2 px-4"
                  disabled={busy}
                  onClick={() => openTemplateSave("update")}
                >
                  <Save aria-hidden="true" className="h-4 w-4" />
                  Aggiorna modello
                </button>
              ) : null}
              <button
                type="button"
                className="btn-secondary inline-flex items-center justify-center gap-2 px-4"
                disabled={busy}
                onClick={() => openTemplateSave("create")}
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
                {selectedTemplate ? "Salva come nuovo modello" : "Salva come modello"}
              </button>
            </div>
          </div>
        </section>

        <aside className="grid gap-6 xl:self-center">
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
              Seleziona le righe con le checkbox. La checkbox in testa alla
              tabella seleziona o deseleziona tutte le persone mostrate dai
              filtri correnti.
            </p>
          </div>
          <span className="max-w-sm rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] px-3 py-2 text-xs font-semibold text-[var(--peace-muted)]">
            Nessun limite di selezione. L’invio usa tranche automatiche fino a
            300 email al giorno.
          </span>
        </div>
        <div
          role="tablist"
          aria-label="Tipo di destinatari"
          className="flex w-fit rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-1"
        >
          <button
            type="button"
            role="tab"
            id="campaign-audience-participants-tab"
            aria-controls="campaign-audience-panel"
            aria-selected={audience === "participants"}
            className={[
              "rounded px-4 py-2 text-sm font-bold",
              audience === "participants"
                ? "bg-[var(--peace-blue-800)] text-white"
                : "text-[var(--peace-blue-900)]",
            ].join(" ")}
            onClick={() => changeAudience("participants")}
          >
            Partecipanti
          </button>
          <button
            type="button"
            role="tab"
            id="campaign-audience-leaders-tab"
            aria-controls="campaign-audience-panel"
            aria-selected={audience === "group_leaders"}
            className={[
              "rounded px-4 py-2 text-sm font-bold",
              audience === "group_leaders"
                ? "bg-[var(--peace-blue-800)] text-white"
                : "text-[var(--peace-blue-900)]",
            ].join(" ")}
            onClick={() => changeAudience("group_leaders")}
          >
            Capigruppo
          </button>
          <button
            type="button"
            role="tab"
            id="campaign-audience-teachers-tab"
            aria-controls="campaign-audience-panel"
            aria-selected={audience === "teachers"}
            className={[
              "rounded px-4 py-2 text-sm font-bold",
              audience === "teachers"
                ? "bg-[var(--peace-blue-800)] text-white"
                : "text-[var(--peace-blue-900)]",
            ].join(" ")}
            onClick={() => changeAudience("teachers")}
          >
            Professori
          </button>
        </div>
        <div
          id="campaign-audience-panel"
          role="tabpanel"
          aria-labelledby={
            audience === "participants"
              ? "campaign-audience-participants-tab"
              : audience === "group_leaders"
                ? "campaign-audience-leaders-tab"
                : "campaign-audience-teachers-tab"
          }
          className="grid gap-5"
        >
          <p className="text-sm text-[var(--peace-muted)]">
            {audience === "participants"
              ? "Questa tabella contiene gli iscritti raggiungibili, comprese le persone senza gruppo."
              : audience === "group_leaders"
                ? "Questa tabella contiene solo i capigruppo dell’evento. Ogni capogruppo compare una sola volta anche se segue più gruppi."
                : "Questa tabella contiene i professori con prenotazioni scuola attive. Ogni docente compare una sola volta anche se segue più classi o panel."}
          </p>
          <div className={[
            "grid gap-4 md:grid-cols-2",
            audience === "participants" ? "xl:grid-cols-6" : audience === "teachers" ? "xl:grid-cols-3" : "xl:grid-cols-3",
          ].join(" ")}>
          <label className="grid gap-1 text-sm font-semibold">
            {audience === "participants" ? "Cerca partecipante" : audience === "group_leaders" ? "Cerca capogruppo" : "Cerca professore"}
            <input
              type="search"
              className="field font-normal"
              value={recipientSearch}
              onChange={(event) => setRecipientSearch(event.target.value)}
              placeholder="Nome o email"
              autoComplete="off"
            />
          </label>
          {audience !== "teachers" ? <RecipientFilterInput
              id="campaign-recipient-group"
              label="Gruppo"
              options={groups}
              placeholder="Tutti i gruppi"
              value={groupFilter}
              onChange={setGroupFilter}
            /> : null}
          {audience === "participants" ? (
            <>
              <label
                className="grid gap-1 text-sm font-semibold"
                htmlFor="campaign-group-membership"
              >
                Appartenenza a un gruppo
                <select
                  id="campaign-group-membership"
                  className="field font-normal"
                  value={groupMembershipFilter}
                  onChange={(event) => {
                    const value = event.target.value as typeof groupMembershipFilter;
                    setGroupMembershipFilter(value);
                    if (value === "without_group") setGroupFilter("");
                  }}
                >
                  <option value="all">Con o senza gruppo</option>
                  <option value="with_group">Solo con gruppo</option>
                  <option value="without_group">Solo senza gruppo</option>
                </select>
              </label>
              <RecipientFilterInput
                id="campaign-recipient-tag"
                label="Tag operativo"
                options={tags}
                placeholder="Tutti i tag"
                value={tagFilter}
                onChange={setTagFilter}
              />
              <RecipientFilterInput
                id="campaign-recipient-service"
                label="Servizio"
                options={services}
                placeholder="Tutti i servizi"
                value={serviceFilter}
                onChange={setServiceFilter}
              />
              <RecipientFilterInput
                id="campaign-recipient-panel"
                label="Panel"
                options={panels}
                placeholder="Tutti i panel"
                value={panelFilter}
                onChange={setPanelFilter}
              />
            </>
          ) : audience === "teachers" ? <>
            <label className="grid gap-1 text-sm font-semibold">
              Scuola
              <input
                type="search"
                className="field font-normal"
                value={schoolFilter}
                onChange={(event) => setSchoolFilter(event.target.value)}
                placeholder="Tutte le scuole"
                autoComplete="off"
              />
            </label>
            <RecipientFilterInput
              id="campaign-teacher-panel"
              label="Panel"
              options={panels}
              placeholder="Tutti i panel"
              value={panelFilter}
              onChange={setPanelFilter}
            />
          </> : null}
          </div>
        {recipientRows.some((recipient) =>
          audience === "participants"
            ? recipient.recipientType === "participant"
            : audience === "group_leaders"
              ? recipient.recipientType === "group_leader"
              : recipient.recipientType === "teacher"
        ) ? (
          <div className="grid gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border-2 border-[var(--peace-sky-400)] bg-[var(--peace-sky-100)] p-4 shadow-sm">
              <div>
                <p className="font-bold text-[var(--peace-blue-950)]">
                  Destinatari selezionati: {selectedRecipientIds.length}
                </p>
                <p className="mt-1 text-sm text-[var(--peace-muted)]">
                  {audience === "participants"
                    ? `${selectedDirectCount} email ai partecipanti e ${selectedDelegatedCount} invii delegati ai referenti.`
                    : audience === "group_leaders"
                      ? `${selectedRecipientIds.length} email ai capigruppo.`
                      : `${selectedRecipientIds.length} email ai professori.`}
                </p>
              </div>
              {selectedRecipientIds.length ? (
                <button
                  type="button"
                  className="btn-secondary px-3 text-xs"
                  onClick={() => {
                    setSelectedRecipientIds([]);
                    resetPreview();
                  }}
                >
                  Deseleziona tutti
                </button>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-md border border-[var(--peace-border)]">
              <div className="max-h-[30rem] overflow-auto">
                <table className="w-full min-w-[42rem] text-left text-sm">
                  <thead className="sticky top-0 z-10 border-b border-[var(--peace-border)] bg-[#f7fbfe] text-xs uppercase tracking-wide text-[var(--peace-muted)]">
                    <tr>
                      <th className="w-14 px-4 py-3 text-center">
                        <input
                          ref={selectFilteredCheckboxRef}
                          type="checkbox"
                          checked={allFilteredSelected}
                          disabled={filteredRecipientRows.length === 0}
                          onChange={(event) =>
                            setAllFilteredRecipientsSelected(event.target.checked)
                          }
                          aria-label={`Seleziona tutte le ${filteredRecipientRows.length} persone filtrate`}
                        />
                      </th>
                      <th className="px-3 py-3">Persona</th>
                      <th className="px-3 py-3">Email</th>
                      <th className="px-3 py-3">
                        {audience === "participants" ? "Recapito" : audience === "group_leaders" ? "Gruppi" : "Scuole e panel"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecipientRows.map((recipient) => (
                      <tr
                        key={recipient.recipientKey}
                        className={[
                          "border-b border-[var(--peace-border)] last:border-0",
                          selectedRecipientIdSet.has(recipient.recipientKey)
                            ? "bg-[var(--peace-sky-100)]"
                            : "bg-white",
                        ].join(" ")}
                      >
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedRecipientIdSet.has(recipient.recipientKey)}
                            onChange={(event) =>
                              setRecipientSelected(
                                recipient.recipientKey,
                                event.target.checked
                              )
                            }
                            aria-label={`Seleziona ${recipient.fullName}`}
                          />
                        </td>
                        <td className="px-3 py-3 font-semibold">{recipient.fullName}</td>
                        <td className="px-3 py-3 text-[var(--peace-muted)]">
                          {recipient.destinationEmail}
                        </td>
                        <td className="px-3 py-3">
                          {audience === "group_leaders" ? (
                            groupLabels(recipient.groupIds, groupLabelById)
                          ) : audience === "teachers" ? (
                            <span className="text-xs text-[var(--peace-muted)]">
                              {recipient.schoolNames.join(", ") || "Scuola non indicata"}
                              {recipient.panelIds.length ? ` · ${recipient.panelIds.flatMap((id) => panelLabelById.get(id) ?? []).join(", ")}` : ""}
                            </span>
                          ) : recipient.deliveryKind === "delegated" ? (
                            <span className="inline-flex rounded-full bg-[var(--peace-sky-100)] px-2 py-1 text-[0.7rem] font-bold text-[var(--peace-blue-800)]">
                              Invio al referente
                            </span>
                          ) : recipient.groupIds.length === 0 ? (
                            <span className="text-xs font-semibold text-[var(--peace-muted)]">
                              Senza gruppo
                            </span>
                          ) : (
                            <span className="text-xs text-[var(--peace-muted)]">
                              Email partecipante
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-[var(--peace-border)] bg-[#f7fbfe] px-4 py-3 text-xs font-semibold text-[var(--peace-muted)]">
                {filteredRecipientRows.length} righe mostrate · {filteredSelectedCount} selezionate nei filtri correnti
              </div>
            </div>
            {filteredRecipientRows.length === 0 ? (
              <p className="rounded-md bg-[#f7fbfe] p-4 text-sm text-[var(--peace-muted)]">
                Nessuna persona corrisponde ai filtri impostati.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="rounded-md bg-[#f7fbfe] p-4 text-sm text-[var(--peace-muted)]">
            {audience === "participants"
              ? "Non ci sono partecipanti raggiungibili per l’evento corrente."
              : audience === "group_leaders"
                ? "Non ci sono capigruppo raggiungibili per l’evento corrente."
                : "Non ci sono professori con prenotazioni attive per l’evento corrente."}
          </p>
        )}
        </div>
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
          <h3 className="text-lg font-bold">Campagne inviate</h3>
        </div>
        {campaigns.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--peace-muted)]">Nessuna campagna inviata.</p>
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

      {showTemplatePicker ? (
        <div className="dashboard-modal fixed inset-0 z-50 grid place-items-center bg-[#072c49]/55 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="template-picker-title"
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[var(--radius-lg)] bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="template-picker-title" className="text-xl font-bold">
                  Modelli riutilizzabili
                </h3>
                <p className="mt-1 text-sm text-[var(--peace-muted)]">
                  Scegli un modello: oggetto e messaggio verranno caricati nel passaggio 1 e resteranno modificabili.
                </p>
              </div>
              <button
                type="button"
                className="grid min-h-9 min-w-9 shrink-0 place-items-center rounded border border-[var(--peace-border)]"
                aria-label="Chiudi modelli riutilizzabili"
                onClick={() => setShowTemplatePicker(false)}
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
            {savedTemplates.length ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {savedTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className={[
                      "rounded-md border p-4 text-left transition",
                      template.id === templateId
                        ? "border-[var(--peace-blue-700)] bg-[var(--peace-sky-100)]"
                        : "border-[var(--peace-border)] hover:bg-[#f7fbfe]",
                    ].join(" ")}
                    onClick={() => loadTemplate(template)}
                  >
                    <span className="flex items-center gap-2 font-bold">
                      <FileText aria-hidden="true" className="h-4 w-4" />
                      {template.name}
                    </span>
                    <span className="mt-2 block text-sm text-[var(--peace-muted)]">
                      {template.subject}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-5 rounded-md bg-[#f7fbfe] p-4 text-sm text-[var(--peace-muted)]">
                Nessun modello salvato.
              </p>
            )}
            <div className="mt-5 border-t border-[var(--peace-border)] pt-4">
              <button
                type="button"
                className="btn-secondary inline-flex items-center justify-center gap-2 px-4"
                onClick={startNewTemplate}
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
                Inizia con un messaggio vuoto
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showTemplateSave ? (
        <div className="dashboard-modal fixed inset-0 z-50 grid place-items-center bg-[#072c49]/55 p-4">
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="template-save-title"
            className="w-full max-w-lg rounded-[var(--radius-lg)] bg-white p-5 shadow-2xl sm:p-6"
            onSubmit={(event) => {
              event.preventDefault();
              void saveTemplate();
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="template-save-title" className="text-xl font-bold">
                  {templateSaveMode === "update"
                    ? "Aggiorna il modello"
                    : selectedTemplate
                      ? "Salva come nuovo modello"
                      : "Salva come modello"}
                </h3>
                <p className="mt-1 text-sm text-[var(--peace-muted)]">
                  {templateSaveMode === "update"
                    ? "Oggetto, messaggio e titolo interno del modello selezionato verranno aggiornati."
                    : selectedTemplate
                      ? "Scegli un nuovo titolo interno. Il modello di partenza non verrà modificato."
                      : "Il titolo interno serve a riconoscere il modello e non viene mostrato ai destinatari."}
                </p>
              </div>
              <button
                type="button"
                className="grid min-h-9 min-w-9 shrink-0 place-items-center rounded border border-[var(--peace-border)]"
                aria-label="Chiudi salvataggio modello"
                onClick={() => setShowTemplateSave(false)}
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
            <label className="mt-5 grid gap-1 text-sm font-semibold">
              Titolo interno del modello
              <input
                className="field font-normal"
                value={templateName}
                onChange={(event) => {
                  setTemplateName(event.target.value);
                  setTemplateSaveError("");
                }}
                maxLength={80}
                placeholder="Es. Informazioni pratiche di ottobre"
                autoComplete="off"
                required
                autoFocus
              />
            </label>
            {templateSaveError ? (
              <p className="status-error mt-3">{templateSaveError}</p>
            ) : null}
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className="btn-secondary px-4"
                onClick={() => setShowTemplateSave(false)}
              >
                Annulla
              </button>
              <button
                type="submit"
                className="btn-primary inline-flex items-center justify-center gap-2 px-4"
                disabled={busy || !templateName.trim()}
              >
                <Save aria-hidden="true" className="h-4 w-4" />
                {templateSaveMode === "update"
                  ? "Aggiorna modello"
                  : selectedTemplate
                    ? "Salva nuovo modello"
                    : "Salva modello"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

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
                  {preview.teacherCount > 0
                    ? `${preview.recipientCount} email ai professori.`
                    : preview.leaderCount > 0
                    ? `${preview.recipientCount} email ai capigruppo.`
                    : `${preview.recipientCount} destinatari: ${preview.directCount} email ai partecipanti e ${preview.delegatedCount} ai referenti.`}
                </p>
                {preview.recipientCount > 300 ? (
                  <p className="mt-2 text-sm font-semibold text-[var(--peace-blue-800)]">
                    Le prime 300 email compatibili con la quota giornaliera
                    partiranno oggi; le altre saranno programmate
                    automaticamente nei giorni successivi, fino a 300 al giorno.
                  </p>
                ) : null}
              </div>
              <button type="button" className="grid min-h-9 min-w-9 place-items-center rounded border border-[var(--peace-border)]" aria-label="Chiudi anteprima" onClick={resetPreview}>
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-4 text-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--peace-muted)]">
                Anteprima dell’email di prova
              </p>
              <p className="mt-1 text-[var(--peace-muted)]">
                Quella mostrata qui sotto è l’email che riceverai come prova. I campi
                personalizzati sono già compilati con i dati di{" "}
                <strong className="text-[var(--peace-ink)]">{preview.sampleRecipientName}</strong>;{" "}
                {preview.sampleRecipientName} non riceverà questa email.
              </p>
            </div>
            <div className="mt-4 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-4">
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
              <div className="rounded-md bg-[#f7fbfe] p-4 text-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--peace-muted)]">
                  Destinatario dell’email di prova
                </p>
                <p className="mt-1 break-all font-bold text-[var(--peace-blue)]">
                  {preview.testRecipientEmail}
                </p>
                <p className="mt-1 text-[var(--peace-muted)]">
                  È l’indirizzo associato all’account manager con cui hai effettuato l’accesso.
                </p>
              </div>
              {error ? (
                <p role="alert" className="rounded-md border border-[#f0b8b1] bg-[#fff3f1] p-3 text-sm text-[var(--peace-danger)]">
                  {error}
                </p>
              ) : null}
              {!testSent ? (
                <button type="button" className="btn-secondary justify-self-start" disabled={busy} aria-busy={busy} onClick={sendTest}>
                  <Send aria-hidden="true" className="h-4 w-4" />
                  <span className="break-all text-left">
                    {busy
                      ? "Invio dell’email di prova in corso…"
                      : `1. Invia la prova a ${preview.testRecipientEmail}`}
                  </span>
                </button>
              ) : null}
              {testSent ? (
                <div role="status" className="rounded-md border border-[#bde4ce] bg-[#edf9f2] p-4 text-sm text-[#16613d]">
                  <p className="font-bold">Email di prova inviata</p>
                  <p className="mt-1">
                    La prova è stata inviata a{" "}
                    <strong className="break-all">{preview.testRecipientEmail}</strong>.
                    Apri quella casella e controlla che oggetto, testo, campi
                    personalizzati, immagini e allegati siano corretti.
                  </p>
                  <p className="mt-2">
                    Se è tutto a posto, procedi con l’invio della campagna. Se devi
                    correggere qualcosa, torna alla composizione: dopo la nuova
                    anteprima sarà necessario inviare un altro test.
                  </p>
                </div>
              ) : null}
              <div className="justify-self-start">
                <div className="flex flex-wrap gap-3">
                  {testSent ? (
                    <button type="button" className="btn-secondary" disabled={busy} onClick={resetPreview}>
                      Torna alla composizione
                    </button>
                  ) : null}
                  <span
                    className="group relative inline-flex"
                    tabIndex={!testSent ? 0 : undefined}
                    aria-describedby={!testSent ? "campaign-send-disabled-help" : undefined}
                  >
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={busy || !testSent}
                      onClick={() => setShowSendConfirmation(true)}
                    >
                      <Mail aria-hidden="true" className="h-4 w-4" />
                      2. Invia a {preview.recipientCount} destinatari
                    </button>
                    {!testSent ? (
                      <span
                        id="campaign-send-disabled-help"
                        role="tooltip"
                        className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-max max-w-64 -translate-x-1/2 rounded bg-[#072c49] px-3 py-2 text-center text-xs font-semibold text-white shadow-lg group-hover:block group-focus:block"
                      >
                        Prima di inviare la campagna devi effettuare l’email di prova.
                      </span>
                    ) : null}
                  </span>
                </div>
              </div>
            </div>
          </section>
          {showSendConfirmation ? (
            <div className="fixed inset-0 z-[60] grid place-items-center bg-[#072c49]/65 p-4">
              <section
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="campaign-send-confirmation-title"
                aria-describedby="campaign-send-confirmation-description"
                className="w-full max-w-lg rounded-[var(--radius-lg)] bg-white p-5 shadow-2xl sm:p-6"
              >
                <h3 id="campaign-send-confirmation-title" className="text-xl font-bold">
                  Confermi l’invio della campagna?
                </h3>
                <p id="campaign-send-confirmation-description" className="mt-3 text-sm text-[var(--peace-muted)]">
                  Stai per inviare “{preview.previewSubject}” a {preview.recipientCount} destinatari.
                  L’invio e la pianificazione delle tranche successive non possono
                  essere annullati dopo la conferma.
                </p>
                {preview.recipientCount > 300 ? (
                  <p className="mt-2 text-sm font-semibold text-[var(--peace-blue-800)]">
                    Saranno accodate tranche fino a 300 email al giorno.
                  </p>
                ) : null}
                {preview.attachments.length ? (
                  <p className="mt-2 text-sm text-[var(--peace-muted)]">
                    La campagna include {preview.attachments.length} file.
                  </p>
                ) : null}
                <div className="mt-6 flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={busy}
                    onClick={() => setShowSendConfirmation(false)}
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busy}
                    aria-busy={busy}
                    onClick={sendCampaign}
                  >
                    Conferma
                  </button>
                </div>
              </section>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function RecipientFilterInput({
  id,
  label,
  onChange,
  options,
  placeholder,
  value,
}: {
  id: string;
  label: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder: string;
  value: string;
}) {
  const listId = `${id}-options`;

  return (
    <label className="grid gap-1 text-sm font-semibold" htmlFor={id}>
      {label}
      <input
        id={id}
        type="search"
        className="field font-normal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        list={listId}
        autoComplete="off"
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option.id} value={option.label} />
        ))}
      </datalist>
    </label>
  );
}

function matchingOptionIds(options: Option[], query: string) {
  const normalizedQuery = normalizeRecipientSearch(query);
  return new Set(
    options
      .filter((option) => !normalizedQuery || normalizeRecipientSearch(option.label).includes(normalizedQuery))
      .map((option) => option.id)
  );
}

function normalizeRecipientSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function groupLabels(groupIds: string[], groupLabelById: ReadonlyMap<string, string>) {
  const labels = groupIds.flatMap((groupId) => {
    const label = groupLabelById.get(groupId);
    return label ? [label] : [];
  });
  return labels.join(", ") || "Gruppo non disponibile";
}

function campaignStatusLabel(status: string) {
  switch (status) {
    case "completed": return "Completata";
    case "partial": return "Parziale";
    case "failed": return "Non riuscita";
    case "scheduled": return "Programmata";
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
