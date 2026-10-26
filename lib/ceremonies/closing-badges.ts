import type { SupportedLocale } from "../i18n/config.ts";
import type { CampaignBadgeTemplate } from "../email/campaign-badge.ts";

export const CLOSING_BADGE_LAYOUT = "assisi-closing-badges-2026";
export const CLOSING_BADGE_SECTORS = [
  { code: "CLOSING_ORANGE", name: "Chiesa Basilica inferiore", color: "Arancione", hex: "#ea580c", capacity: 200, template: "basilica-inferiore-arancione-v1" },
  { code: "CLOSING_PURPLE", name: "Piazza inferiore", color: "Viola", hex: "#7e22ce", capacity: 1100, template: "piazza-inferiore-viola-v1" },
  { code: "CLOSING_GREEN", name: "Prato Basilica superiore", color: "Verde", hex: "#15803d", capacity: 2200, template: "prato-basilica-superiore-verde-v1" },
] as const satisfies readonly { code: string; name: string; color: string; hex: string; capacity: number; template: CampaignBadgeTemplate }[];
export type ClosingBadgeCode = typeof CLOSING_BADGE_SECTORS[number]["code"];
export function closingBadgeSector(code: unknown) {
  return CLOSING_BADGE_SECTORS.find(sector => sector.code === code) ?? null;
}
export const CLOSING_BADGE_COPY: Record<SupportedLocale, { download: string; badge: string; colors: readonly [string, string, string] }> = {
  it: { download: "Scarica badge PDF", badge: "Badge", colors: ["Arancione", "Viola", "Verde"] },
  en: { download: "Download badge PDF", badge: "Badge", colors: ["Orange", "Purple", "Green"] },
  fr: { download: "Télécharger le badge PDF", badge: "Badge", colors: ["Orange", "Violet", "Vert"] },
  de: { download: "Badge als PDF herunterladen", badge: "Badge", colors: ["Orange", "Violett", "Grün"] },
  es: { download: "Descargar acreditación PDF", badge: "Acreditación", colors: ["Naranja", "Morado", "Verde"] },
  nl: { download: "Badge als PDF downloaden", badge: "Badge", colors: ["Oranje", "Paars", "Groen"] },
  uk: { download: "Завантажити бейдж PDF", badge: "Бейдж", colors: ["Помаранчевий", "Фіолетовий", "Зелений"] },
};
export function closingBadgeColor(code: unknown, locale: SupportedLocale = "it") {
  const index = CLOSING_BADGE_SECTORS.findIndex(s => s.code === code);
  return index < 0 ? "" : CLOSING_BADGE_COPY[locale].colors[index];
}
