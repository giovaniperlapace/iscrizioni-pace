import type { SupportedLocale } from "../i18n/config.ts";

export type ForumChildOption = { id: string; name: string; selected: boolean };
export const FORUM_CHILD_COPY: Record<SupportedLocale, { title: string; help: string; saved: string }> = {
  it: { title: "Quali minori partecipano a questo Forum?", help: "Seleziona solo i minori che partecipano con te. Se non selezioni nessuno, prenoti solo per l’adulto. La scelta vale anche per la lista d’attesa.", saved: "Minori inclusi nella richiesta. Per cambiare la scelta, cancella la prenotazione o esci dalla coda e prenota di nuovo." },
  en: { title: "Which children will attend this Forum?", help: "Select only the children attending with you. If none are selected, you book for the adult only. This also applies to the waiting list.", saved: "Children included in this request. To change them, cancel the booking or leave the queue and book again." },
  fr: { title: "Quels mineurs participent à ce Forum ?", help: "Sélectionnez uniquement les mineurs qui vous accompagnent. Sans sélection, la réservation concerne seulement l’adulte. Ce choix vaut aussi pour la liste d’attente.", saved: "Mineurs inclus dans la demande. Pour modifier le choix, annulez la réservation ou quittez la liste d’attente, puis réservez à nouveau." },
  de: { title: "Welche Minderjährigen nehmen an diesem Forum teil?", help: "Wähle nur die Minderjährigen aus, die mit dir teilnehmen. Ohne Auswahl buchst du nur für den Erwachsenen. Dies gilt auch für die Warteliste.", saved: "In dieser Anfrage enthaltene Minderjährige. Zum Ändern storniere die Buchung oder verlasse die Warteliste und buche erneut." },
  es: { title: "¿Qué menores participan en este Foro?", help: "Selecciona solo los menores que participan contigo. Si no seleccionas ninguno, reservas solo para el adulto. La selección también se aplica a la lista de espera.", saved: "Menores incluidos en la solicitud. Para cambiarlos, cancela la reserva o sal de la lista de espera y vuelve a reservar." },
  nl: { title: "Welke minderjarigen nemen deel aan dit forum?", help: "Selecteer alleen de minderjarigen die met je deelnemen. Zonder selectie boek je alleen voor de volwassene. Dit geldt ook voor de wachtlijst.", saved: "Minderjarigen in deze aanvraag. Annuleer de boeking of verlaat de wachtlijst en boek opnieuw om dit te wijzigen." },
  uk: { title: "Які неповнолітні візьмуть участь у цьому форумі?", help: "Оберіть лише неповнолітніх, які беруть участь разом із вами. Без вибору бронювання стосується лише дорослого. Це також діє для списку очікування.", saved: "Неповнолітні, включені до заявки. Щоб змінити вибір, скасуйте бронювання або вийдіть із черги та забронюйте знову." },
};

export function validForumChildIds(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 10 && new Set(value).size === value.length &&
    value.every(id => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
}
