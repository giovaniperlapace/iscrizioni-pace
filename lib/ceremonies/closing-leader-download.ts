import type { LeaderTickets } from "./leader-tickets.ts";
import { closingBadgeSector } from "./closing-badges.ts";
import type { SupportedLocale } from "../i18n/config.ts";

export const CLOSING_DOWNLOAD_COPY: Record<SupportedLocale, { download: string; preparing: string; help: string; empty: string }> = {
  it: { download: "Scarica tutti i biglietti in un unico PDF", preparing: "Preparazione del PDF…", help: "Tutti i settori e i gruppi gestiti, un biglietto assegnato per pagina.", empty: "Non ci sono biglietti assegnati da scaricare." },
  en: { download: "Download all tickets in one PDF", preparing: "Preparing PDF…", help: "All sectors and groups you manage, one assigned ticket per page.", empty: "There are no assigned tickets to download." },
  fr: { download: "Télécharger tous les billets dans un seul PDF", preparing: "Préparation du PDF…", help: "Tous les secteurs et groupes gérés, un billet attribué par page.", empty: "Aucun billet attribué à télécharger." },
  de: { download: "Alle Tickets als eine PDF herunterladen", preparing: "PDF wird erstellt…", help: "Alle verwalteten Bereiche und Gruppen, ein zugewiesenes Ticket pro Seite.", empty: "Keine zugewiesenen Tickets zum Herunterladen vorhanden." },
  es: { download: "Descargar todos los billetes en un solo PDF", preparing: "Preparando el PDF…", help: "Todos los sectores y grupos gestionados, un billete asignado por página.", empty: "No hay billetes asignados para descargar." },
  nl: { download: "Alle tickets in één PDF downloaden", preparing: "PDF wordt voorbereid…", help: "Alle beheerde sectoren en groepen, één toegewezen ticket per pagina.", empty: "Er zijn geen toegewezen tickets om te downloaden." },
  uk: { download: "Завантажити всі квитки одним PDF-файлом", preparing: "Підготовка PDF…", help: "Усі сектори й групи під вашим керуванням, один призначений квиток на сторінку.", empty: "Немає призначених квитків для завантаження." },
};

// The canonical leader snapshot already excludes revoked allocations/nominees
// and scopes active registrations to the actor's current groups. Use current
// people/children names, not the historical subject_name on nominations.
export function closingLeaderDownloadTickets(view: LeaderTickets) {
  const allocations = new Map(view.allocations.filter(a => a.kind === "closing" && a.state === "validated" && closingBadgeSector(a.badgeCode)).map(a => [a.id, a]));
  const people = new Map(view.people.map(p => [p.registrationId, p]));
  const seen = new Set<string>();
  return view.nominees.flatMap(n => {
    const allocation = allocations.get(n.allocationId);
    const person = people.get(n.registrationId);
    if (!allocation || !person || !n.needsSeat || seen.has(n.id)) return [];
    const name = n.childId ? person.children.find(child => child.id === n.childId)?.name : person.name;
    if (!name) return [];
    seen.add(n.id);
    return [{ id: n.id, name, template: closingBadgeSector(allocation.badgeCode)!.template, sector: allocation.badgeCode! }];
  }).sort((a, b) => a.sector.localeCompare(b.sector) || a.name.localeCompare(b.name, "it") || a.id.localeCompare(b.id));
}
