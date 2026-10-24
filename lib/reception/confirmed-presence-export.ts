import type { SupportedLocale } from "../i18n/config.ts";

export const CONFIRMED_PRESENCE_EXPORT_COPY = {
  it: { header: "Presenza confermata (badge ritirato)", yes: "Sì", no: "No" },
  en: { header: "Attendance confirmed (badge collected)", yes: "Yes", no: "No" },
  fr: { header: "Présence confirmée (badge retiré)", yes: "Oui", no: "Non" },
  de: { header: "Anwesenheit bestätigt (Badge abgeholt)", yes: "Ja", no: "Nein" },
  es: { header: "Asistencia confirmada (acreditación recogida)", yes: "Sí", no: "No" },
  nl: { header: "Aanwezigheid bevestigd (badge opgehaald)", yes: "Ja", no: "Nee" },
  uk: { header: "Присутність підтверджено (бейдж отримано)", yes: "Так", no: "Ні" },
} satisfies Record<SupportedLocale, { header: string; yes: string; no: string }>;

export function confirmedPresenceExportText(confirmed: boolean | undefined, locale: SupportedLocale = "it") {
  if (confirmed === undefined) return "—";
  return CONFIRMED_PRESENCE_EXPORT_COPY[locale][confirmed ? "yes" : "no"];
}
