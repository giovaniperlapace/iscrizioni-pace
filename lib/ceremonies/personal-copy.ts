import type { SupportedLocale } from "../i18n/config.ts";
export const PERSONAL_CEREMONY_COPY: Record<SupportedLocale, { empty: string; loading: string }> = {
  it: { empty: "Il settore assegnato a te e agli eventuali figli accompagnati comparirà qui quando il manager o il capogruppo completerà l’assegnazione.", loading: "Caricamento del settore assegnato…" },
  en: { empty: "The sector assigned to you and any accompanying children will appear here once the manager or group leader completes the assignment.", loading: "Loading your assigned sector…" },
  fr: { empty: "Le secteur attribué à vous et aux enfants accompagnés apparaîtra ici lorsque le responsable ou le chef de groupe aura terminé l’attribution.", loading: "Chargement du secteur attribué…" },
  de: { empty: "Der Ihnen und Ihren begleitenden Kindern zugewiesene Sektor erscheint hier, sobald die Verwaltung oder Gruppenleitung die Zuweisung abgeschlossen hat.", loading: "Zugewiesener Sektor wird geladen…" },
  es: { empty: "El sector asignado a ti y a los menores acompañados aparecerá aquí cuando el responsable o el jefe de grupo complete la asignación.", loading: "Cargando el sector asignado…" },
  nl: { empty: "De sector voor jou en eventuele begeleide kinderen verschijnt hier zodra de manager of groepsleider de toewijzing heeft voltooid.", loading: "Toegewezen sector laden…" },
  uk: { empty: "Сектор, призначений вам і дітям у вашому супроводі, з’явиться тут, коли менеджер або керівник групи завершить призначення.", loading: "Завантаження призначеного сектора…" },
};
