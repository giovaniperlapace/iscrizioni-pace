export const CAMPAIGN_BADGE_TEMPLATE = "piazza-inferiore-viola-v1";
export const CAMPAIGN_BADGE_TEMPLATES = [
  { id: CAMPAIGN_BADGE_TEMPLATE, label: "Piazza Inferiore · viola", title: "Piazza Inferiore", fileStem: "badge-piazza-inferiore", cid: "personalized-badge@iscrizioni-pace" },
  { id: "prato-basilica-superiore-verde-v1", label: "Prato Basilica superiore · verde", title: "Prato Basilica superiore", fileStem: "badge-prato-basilica-superiore", cid: "badge-prato-basilica-superiore@iscrizioni-pace" },
  { id: "basilica-inferiore-arancione-v1", label: "Basilica Inferiore · arancione", title: "Basilica Inferiore", fileStem: "badge-basilica-inferiore", cid: "badge-basilica-inferiore@iscrizioni-pace" },
] as const;
export type CampaignBadgeTemplate = typeof CAMPAIGN_BADGE_TEMPLATES[number]["id"];

export function campaignBadgeRequest(value: unknown, audience: string) {
  if (value === undefined || value === false || value === "false") return null;
  if (value !== true && value !== "true") throw new Error("Opzione badge non valida.");
  if (audience !== "participants") throw new Error("Il badge personalizzato è disponibile per i partecipanti.");
  return CAMPAIGN_BADGE_TEMPLATE;
}

function validTemplates(value: unknown): CampaignBadgeTemplate[] {
  if (!Array.isArray(value) || value.length > CAMPAIGN_BADGE_TEMPLATES.length ||
    value.some(id => !CAMPAIGN_BADGE_TEMPLATES.some(template => template.id === id))) {
    throw new Error("Opzione badge non valida.");
  }
  // Stable order and no duplicate PDFs/CIDs, even for repeated request values.
  return CAMPAIGN_BADGE_TEMPLATES.filter(template => value.includes(template.id)).map(template => template.id);
}

export function campaignBadgeSelectionRequest(value: unknown, audience: string, legacyValue?: unknown): CampaignBadgeTemplate[] {
  if (value === undefined) {
    const legacy = campaignBadgeRequest(legacyValue, audience);
    return legacy ? [legacy] : [];
  }
  let parsed: unknown = value;
  if (typeof value === "string") {
    try { parsed = JSON.parse(value); } catch { throw new Error("Opzione badge non valida."); }
  }
  const templates = validTemplates(parsed);
  if (templates.length && audience !== "participants") throw new Error("Il badge personalizzato è disponibile per i partecipanti.");
  return templates;
}

export function campaignBadgeTemplates(snapshot: unknown): CampaignBadgeTemplate[] {
  if (!snapshot || typeof snapshot !== "object") return [];
  if ("badgeTemplates" in snapshot) return validTemplates(snapshot.badgeTemplates);
  // Keep drafts/retries created with the original violet-only option working.
  const template = "badgeTemplate" in snapshot ? snapshot.badgeTemplate : null;
  if (template == null) return [];
  if (template !== CAMPAIGN_BADGE_TEMPLATE) throw new Error("Modello badge non disponibile.");
  return [template];
}

export function campaignHasBadge(snapshot: unknown): boolean {
  return campaignBadgeTemplates(snapshot).length > 0;
}
