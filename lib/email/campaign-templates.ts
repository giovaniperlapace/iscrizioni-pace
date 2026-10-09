export const CAMPAIGN_TEMPLATE_FIELDS = [
  { token: "{{nome}}", label: "Nome" },
  { token: "{{cognome}}", label: "Cognome" },
  { token: "{{nome_completo}}", label: "Nome completo" },
  { token: "{{codice_partecipante}}", label: "Codice partecipante" },
  { token: "{{gruppo}}", label: "Gruppo" },
  { token: "{{scuola}}", label: "Scuola" },
  { token: "{{panel}}", label: "Panel prenotati" },
  { token: "{{evento}}", label: "Evento" },
] as const;

export type CampaignTemplateData = {
  firstName: string;
  lastName: string;
  participantCode: string | null;
  groupName: string | null;
  schoolName?: string | null;
  panelNames?: string | null;
  eventTitle: string;
};

function values(data: CampaignTemplateData): Record<string, string> {
  return {
    nome: data.firstName.trim(),
    cognome: data.lastName.trim(),
    nome_completo: `${data.firstName} ${data.lastName}`.trim(),
    codice_partecipante: data.participantCode?.trim() ?? "",
    gruppo: data.groupName?.trim() ?? "",
    scuola: data.schoolName?.trim() ?? "",
    panel: data.panelNames?.trim() ?? "",
    evento: data.eventTitle.trim(),
  };
}

export function renderCampaignTemplate(template: string, data: CampaignTemplateData) {
  const map = values(data);
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key: string) => map[key] ?? "");
}

export function renderCampaignHtmlTemplate(
  template: string,
  data: CampaignTemplateData
) {
  const map = values(data);
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key: string) =>
    escapeHtml(map[key] ?? "")
  );
}

export function campaignTextToHtml(text: string) {
  return text.split(/\n{2,}/).map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`).join("");
}

export function validateCampaignTemplate(subject: string, body: string): string[] {
  const allowed = new Set(CAMPAIGN_TEMPLATE_FIELDS.map((field) => field.token.slice(2, -2)));
  const tokens = [...`${subject}\n${body}`.matchAll(/\{\{\s*([^}]+)\s*\}\}/g)].map((match) => match[1].trim());
  return [...new Set(tokens.filter((token) => !allowed.has(token)))];
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
