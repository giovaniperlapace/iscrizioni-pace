import { CalendarDays, CheckCircle2, Clock3, MapPin, Users } from "lucide-react";

import { setParticipantPanelBooking } from "@/app/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import type { SupportedLocale } from "@/lib/i18n/config";

export type ParticipantPanelCatalogRow = {
  panel_id: string;
  section_id: string;
  audience_name: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  location_name: string;
  location_address: string | null;
  booking_status: "available" | "selected" | "full" | "conflict";
  party_size: number;
};

type Copy = {
  title: string;
  intro: string;
  empty: string;
  selectedTitle: string;
  availableTitle: string;
  familySeats: (count: number) => string;
  selected: string;
  available: string;
  full: string;
  conflict: string;
  book: string;
  booking: string;
  cancel: string;
  cancelling: string;
  section: string;
  liveAvailability: string;
  savedBooked: string;
  savedCancelled: string;
  errors: Record<string, string>;
};

const COPY: Record<SupportedLocale, Copy> = {
  it: {
    title: "Scegli i tuoi panel",
    intro: "Puoi prenotare i panel disponibili. La scelta vale anche per i minori collegati alla tua iscrizione.",
    empty: "Al momento non ci sono panel disponibili per l'iscrizione individuale.",
    selectedTitle: "I tuoi panel",
    availableTitle: "Programma disponibile",
    familySeats: (count) => `${count} ${count === 1 ? "posto" : "posti"} per la tua iscrizione`,
    selected: "Iscritto",
    available: "Disponibile",
    full: "Completo",
    conflict: "Si sovrappone a un panel già scelto",
    book: "Iscriviti",
    booking: "Iscrizione in corso…",
    cancel: "Cancella iscrizione",
    cancelling: "Cancellazione…",
    section: "Tipo di posto",
    liveAvailability: "La disponibilità viene verificata di nuovo al momento della conferma.",
    savedBooked: "Iscrizione al panel confermata.",
    savedCancelled: "Iscrizione al panel cancellata.",
    errors: {
      full: "Nel frattempo i posti necessari sono terminati. Scegli un altro panel.",
      overlap: "Questo panel si sovrappone a uno che hai già scelto.",
      unavailable: "Il panel non è più disponibile per l'iscrizione.",
      forbidden: "Non puoi modificare questa iscrizione.",
      "not-found": "Il panel o l'iscrizione non sono più disponibili.",
      invalid: "La richiesta non è valida.",
      failed: "Non è stato possibile aggiornare la scelta. Riprova.",
    },
  },
  en: {
    title: "Choose your panels",
    intro: "You can book available panels. Your choice also applies to the children linked to your registration.",
    empty: "There are currently no panels available for individual booking.",
    selectedTitle: "Your panels",
    availableTitle: "Available programme",
    familySeats: (count) => `${count} ${count === 1 ? "seat" : "seats"} for your registration`,
    selected: "Booked",
    available: "Available",
    full: "Full",
    conflict: "Overlaps a panel you already chose",
    book: "Book",
    booking: "Booking…",
    cancel: "Cancel booking",
    cancelling: "Cancelling…",
    section: "Seat type",
    liveAvailability: "Availability is checked again when you confirm.",
    savedBooked: "Panel booking confirmed.",
    savedCancelled: "Panel booking cancelled.",
    errors: {
      full: "The seats you need have become unavailable. Choose another panel.",
      overlap: "This panel overlaps one you have already chosen.",
      unavailable: "This panel is no longer available for booking.",
      forbidden: "You cannot change this registration.",
      "not-found": "The panel or registration is no longer available.",
      invalid: "The request is invalid.",
      failed: "Your choice could not be updated. Please try again.",
    },
  },
  fr: {
    title: "Choisis tes panels",
    intro: "Tu peux réserver les panels disponibles. Ton choix vaut aussi pour les mineurs liés à ton inscription.",
    empty: "Aucun panel n'est actuellement disponible pour l'inscription individuelle.",
    selectedTitle: "Tes panels",
    availableTitle: "Programme disponible",
    familySeats: (count) => `${count} ${count === 1 ? "place" : "places"} pour ton inscription`,
    selected: "Inscrit",
    available: "Disponible",
    full: "Complet",
    conflict: "Chevauche un panel déjà choisi",
    book: "S'inscrire",
    booking: "Inscription…",
    cancel: "Annuler l'inscription",
    cancelling: "Annulation…",
    section: "Type de place",
    liveAvailability: "La disponibilité est vérifiée à nouveau lors de la confirmation.",
    savedBooked: "Inscription au panel confirmée.",
    savedCancelled: "Inscription au panel annulée.",
    errors: {
      full: "Les places nécessaires viennent d'être épuisées. Choisis un autre panel.",
      overlap: "Ce panel chevauche un panel déjà choisi.",
      unavailable: "Ce panel n'est plus disponible.",
      forbidden: "Tu ne peux pas modifier cette inscription.",
      "not-found": "Le panel ou l'inscription n'est plus disponible.",
      invalid: "La demande n'est pas valide.",
      failed: "Impossible de mettre à jour ton choix. Réessaie.",
    },
  },
  de: {
    title: "Wähle deine Panels",
    intro: "Du kannst verfügbare Panels buchen. Deine Wahl gilt auch für die mit deiner Anmeldung verbundenen Minderjährigen.",
    empty: "Derzeit sind keine Panels für Einzelbuchungen verfügbar.",
    selectedTitle: "Deine Panels",
    availableTitle: "Verfügbares Programm",
    familySeats: (count) => `${count} ${count === 1 ? "Platz" : "Plätze"} für deine Anmeldung`,
    selected: "Gebucht",
    available: "Verfügbar",
    full: "Ausgebucht",
    conflict: "Überschneidet sich mit einem gewählten Panel",
    book: "Buchen",
    booking: "Wird gebucht…",
    cancel: "Buchung stornieren",
    cancelling: "Wird storniert…",
    section: "Platzart",
    liveAvailability: "Die Verfügbarkeit wird bei der Bestätigung erneut geprüft.",
    savedBooked: "Panel-Buchung bestätigt.",
    savedCancelled: "Panel-Buchung storniert.",
    errors: {
      full: "Die benötigten Plätze sind inzwischen vergeben. Wähle ein anderes Panel.",
      overlap: "Dieses Panel überschneidet sich mit einem bereits gewählten Panel.",
      unavailable: "Dieses Panel ist nicht mehr buchbar.",
      forbidden: "Du kannst diese Anmeldung nicht ändern.",
      "not-found": "Panel oder Anmeldung ist nicht mehr verfügbar.",
      invalid: "Die Anfrage ist ungültig.",
      failed: "Die Auswahl konnte nicht aktualisiert werden. Versuche es erneut.",
    },
  },
  es: {
    title: "Elige tus paneles",
    intro: "Puedes reservar los paneles disponibles. Tu elección también se aplica a los menores vinculados a tu inscripción.",
    empty: "Ahora mismo no hay paneles disponibles para inscripción individual.",
    selectedTitle: "Tus paneles",
    availableTitle: "Programa disponible",
    familySeats: (count) => `${count} ${count === 1 ? "plaza" : "plazas"} para tu inscripción`,
    selected: "Inscrito",
    available: "Disponible",
    full: "Completo",
    conflict: "Coincide con un panel ya elegido",
    book: "Inscribirse",
    booking: "Inscribiendo…",
    cancel: "Cancelar inscripción",
    cancelling: "Cancelando…",
    section: "Tipo de plaza",
    liveAvailability: "La disponibilidad se vuelve a comprobar al confirmar.",
    savedBooked: "Inscripción al panel confirmada.",
    savedCancelled: "Inscripción al panel cancelada.",
    errors: {
      full: "Las plazas necesarias se han agotado. Elige otro panel.",
      overlap: "Este panel coincide con otro que ya has elegido.",
      unavailable: "Este panel ya no está disponible.",
      forbidden: "No puedes modificar esta inscripción.",
      "not-found": "El panel o la inscripción ya no están disponibles.",
      invalid: "La solicitud no es válida.",
      failed: "No se pudo actualizar la elección. Inténtalo de nuevo.",
    },
  },
  nl: {
    title: "Kies je panels",
    intro: "Je kunt beschikbare panels boeken. Je keuze geldt ook voor minderjarigen die aan je inschrijving zijn gekoppeld.",
    empty: "Er zijn momenteel geen panels beschikbaar voor individuele boeking.",
    selectedTitle: "Jouw panels",
    availableTitle: "Beschikbaar programma",
    familySeats: (count) => `${count} ${count === 1 ? "plaats" : "plaatsen"} voor je inschrijving`,
    selected: "Geboekt",
    available: "Beschikbaar",
    full: "Vol",
    conflict: "Overlapt met een gekozen panel",
    book: "Boeken",
    booking: "Boeken…",
    cancel: "Boeking annuleren",
    cancelling: "Annuleren…",
    section: "Plaastype",
    liveAvailability: "De beschikbaarheid wordt bij de bevestiging opnieuw gecontroleerd.",
    savedBooked: "Panelboeking bevestigd.",
    savedCancelled: "Panelboeking geannuleerd.",
    errors: {
      full: "De benodigde plaatsen zijn inmiddels vol. Kies een ander panel.",
      overlap: "Dit panel overlapt met een panel dat je al koos.",
      unavailable: "Dit panel is niet meer beschikbaar.",
      forbidden: "Je kunt deze inschrijving niet wijzigen.",
      "not-found": "Het panel of de inschrijving is niet meer beschikbaar.",
      invalid: "Het verzoek is ongeldig.",
      failed: "Je keuze kon niet worden bijgewerkt. Probeer opnieuw.",
    },
  },
  uk: {
    title: "Оберіть свої панелі",
    intro: "Ви можете забронювати доступні панелі. Ваш вибір також поширюється на неповнолітніх, пов’язаних із реєстрацією.",
    empty: "Наразі немає панелей для індивідуального бронювання.",
    selectedTitle: "Ваші панелі",
    availableTitle: "Доступна програма",
    familySeats: (count) => `${count} місць для вашої реєстрації`,
    selected: "Заброньовано",
    available: "Доступно",
    full: "Місць немає",
    conflict: "Збігається в часі з обраною панеллю",
    book: "Забронювати",
    booking: "Бронювання…",
    cancel: "Скасувати бронювання",
    cancelling: "Скасування…",
    section: "Тип місця",
    liveAvailability: "Доступність перевіряється повторно під час підтвердження.",
    savedBooked: "Бронювання панелі підтверджено.",
    savedCancelled: "Бронювання панелі скасовано.",
    errors: {
      full: "Потрібні місця щойно закінчилися. Оберіть іншу панель.",
      overlap: "Ця панель збігається в часі з уже обраною.",
      unavailable: "Ця панель більше недоступна.",
      forbidden: "Ви не можете змінювати цю реєстрацію.",
      "not-found": "Панель або реєстрація більше недоступна.",
      invalid: "Запит недійсний.",
      failed: "Не вдалося оновити вибір. Спробуйте ще раз.",
    },
  },
};

type Props = {
  locale: SupportedLocale;
  registrationId: string;
  rows: ParticipantPanelCatalogRow[];
  saved?: string | null;
  error?: string | null;
};

export function ParticipantPanelBookings({ locale, registrationId, rows, saved, error }: Props) {
  const copy = COPY[locale] ?? COPY.en;
  const selected = rows.filter((row) => row.booking_status === "selected");
  const remaining = rows.filter((row) => row.booking_status !== "selected");
  const groups = [
    ...(selected.length > 0 ? [{ title: copy.selectedTitle, rows: selected }] : []),
    ...(remaining.length > 0 ? [{ title: copy.availableTitle, rows: remaining }] : []),
  ];

  return (
    <section aria-labelledby="participant-panels-title" className="grid gap-5">
      <div>
        <h2 id="participant-panels-title" className="text-xl font-semibold text-[var(--peace-blue-950)]">
          {copy.title}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--peace-muted)]">{copy.intro}</p>
      </div>

      {saved ? (
        <p role="status" className="rounded-md border border-[#b9d5bd] bg-[#f0f8ed] px-3 py-2 text-sm text-[#315e3b]">
          {saved === "booked" ? copy.savedBooked : copy.savedCancelled}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-md border border-[#e0b5a9] bg-[#fff3ef] px-3 py-2 text-sm text-[#8a3323]">
          {copy.errors[error] ?? copy.errors.failed}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="rounded-lg border border-[var(--peace-border)] bg-white p-5 text-sm text-[var(--peace-muted)]">
          {copy.empty}
        </p>
      ) : (
        <div className="grid gap-7">
          {groups.map((group, groupIndex) => (
            <section aria-labelledby={`participant-panel-group-${groupIndex}`} className="grid gap-3" key={group.title}>
              <h3 id={`participant-panel-group-${groupIndex}`} className="text-sm font-bold uppercase tracking-wide text-[var(--peace-blue-800)]">
                {group.title}
              </h3>
              <div className="grid gap-4 lg:grid-cols-2">
                {group.rows.map((row) => (
                  <PanelBookingCard copy={copy} locale={locale} registrationId={registrationId} row={row} key={row.section_id} showAudience={rows.filter((candidate) => candidate.panel_id === row.panel_id).length > 1} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {rows.length > 0 ? <p className="text-xs leading-5 text-[var(--peace-muted)]">{copy.liveAvailability}</p> : null}
    </section>
  );
}

function PanelBookingCard({ copy, locale, registrationId, row, showAudience }: {
  copy: Copy;
  locale: SupportedLocale;
  registrationId: string;
  row: ParticipantPanelCatalogRow;
  showAudience: boolean;
}) {
  const isSelected = row.booking_status === "selected";
  const disabled = row.booking_status === "full" || row.booking_status === "conflict";
  const statusLabel = isSelected
    ? copy.selected
    : row.booking_status === "full"
      ? copy.full
      : row.booking_status === "conflict"
        ? copy.conflict
        : copy.available;

  return (
    <article className={`grid gap-4 rounded-xl border bg-white p-5 ${isSelected ? "border-[#8fc99a] shadow-[0_10px_30px_rgba(41,104,61,0.08)]" : "border-[var(--peace-border)]"}`}>
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-lg font-bold text-[var(--peace-blue-950)]">{row.title}</h4>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${isSelected ? "bg-[#e8f6e8] text-[#27613a]" : row.booking_status === "available" ? "bg-[var(--peace-sky-100)] text-[var(--peace-blue-800)]" : "bg-[#fff0eb] text-[#8a3323]"}`}>
          {isSelected ? <CheckCircle2 aria-hidden="true" className="mr-1 inline size-3.5" /> : null}
          {statusLabel}
        </span>
      </div>
      {row.description ? <p className="text-sm leading-6 text-[var(--peace-muted)]">{row.description}</p> : null}
      <dl className="grid gap-2 text-sm text-[var(--peace-ink)]">
        <div className="flex items-start gap-2"><CalendarDays aria-hidden="true" className="mt-0.5 size-4 text-[var(--peace-blue-700)]" /><span>{formatDate(row.starts_at, locale)}</span></div>
        <div className="flex items-start gap-2"><Clock3 aria-hidden="true" className="mt-0.5 size-4 text-[var(--peace-blue-700)]" /><span>{formatTimeRange(row.starts_at, row.ends_at, locale)}</span></div>
        <div className="flex items-start gap-2"><MapPin aria-hidden="true" className="mt-0.5 size-4 text-[var(--peace-blue-700)]" /><span><strong>{row.location_name}</strong>{row.location_address ? ` · ${row.location_address}` : ""}</span></div>
        <div className="flex items-start gap-2"><Users aria-hidden="true" className="mt-0.5 size-4 text-[var(--peace-blue-700)]" /><span>{copy.familySeats(row.party_size)}</span></div>
        {showAudience ? <div><dt className="inline font-semibold">{copy.section}: </dt><dd className="inline">{row.audience_name}</dd></div> : null}
      </dl>
      <form action={setParticipantPanelBooking}>
        <input type="hidden" name="registrationId" value={registrationId} />
        <input type="hidden" name="panelId" value={row.panel_id} />
        <input type="hidden" name="sectionId" value={row.section_id} />
        <input type="hidden" name="intent" value={isSelected ? "cancel" : "book"} />
        <PendingSubmitButton disabled={disabled} pendingLabel={isSelected ? copy.cancelling : copy.booking} className={`min-h-11 w-full rounded-md px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:bg-[#d9e0e6] disabled:text-[#637181] ${isSelected ? "border border-[#cf9b8e] text-[#8a3323] hover:bg-[#fff3ef]" : "bg-[var(--peace-blue-800)] text-white hover:bg-[var(--peace-blue-900)]"}`}>
          {isSelected ? copy.cancel : copy.book}
        </PendingSubmitButton>
      </form>
    </article>
  );
}

function formatDate(value: string, locale: SupportedLocale) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Rome",
  }).format(new Date(value));
}

function formatTimeRange(startsAt: string, endsAt: string, locale: SupportedLocale) {
  const formatter = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  });
  return `${formatter.format(new Date(startsAt))}–${formatter.format(new Date(endsAt))}`;
}
