"use client";
import Link from "next/link";
import { FORUM_ATTENDANCE_COPY } from "@/lib/panels/attendance-copy";
import { useState } from "react";
import { ForumChildSelection } from "@/components/forum-child-selection";
import { FORUM_CHILD_COPY, type ForumChildOption } from "@/lib/panels/child-selection";

import { ForumLanguages } from "@/components/forum-languages";
import { useForumAvailability } from "@/lib/panels/use-forum-availability";
import { FORUM_WAITLIST_COPY } from "@/lib/panels/waitlist-copy";
import { getEventProgramCopy } from "@/lib/events/program-copy";
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
  booking_status: "available" | "selected" | "full" | "conflict" | "queued" | "offered";
  party_size: number;
  children?: ForumChildOption[];
  remaining_seats?: number;
  has_waiting?: boolean;
  has_slot_conflict?: boolean;
  waitlist_status?: string | null;
  offer_expires_at?: string | null;
  queue_position?: number | null;
};

type Copy = {
  title: string;
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
    title: "Scegli i tuoi forum",
    empty: "Al momento non ci sono forum disponibili per l'iscrizione individuale.",
    selectedTitle: "I tuoi forum",
    availableTitle: "Programma disponibile",
    familySeats: (count) => `${count} ${count === 1 ? "posto" : "posti"} per la tua iscrizione`,
    selected: "Iscritto",
    available: "Disponibile",
    full: "Completo",
    conflict: "Si sovrappone a un forum già scelto",
    book: "Iscriviti al Forum",
    booking: "Iscrizione in corso…",
    cancel: "Cancella iscrizione",
    cancelling: "Cancellazione…",
    section: "Tipo di posto",
    liveAvailability: "La disponibilità viene verificata di nuovo al momento della conferma.",
    savedBooked: "Iscrizione al forum confermata.",
    savedCancelled: "Iscrizione al forum cancellata.",
    errors: {
      full: "Nel frattempo i posti necessari sono terminati. Scegli un altro forum.",
      overlap: "Questo forum si sovrappone a uno che hai già scelto.",
      unavailable: "Il forum non è più disponibile per l'iscrizione.",
      forbidden: "Non puoi modificare questa iscrizione.",
      "not-found": "Il forum o l'iscrizione non sono più disponibili.",
      invalid: "La richiesta non è valida.",
      failed: "Non è stato possibile aggiornare la scelta. Riprova.",
    },
  },
  en: {
    title: "Choose your forums",
    empty: "There are currently no forums available for individual booking.",
    selectedTitle: "Your forums",
    availableTitle: "Available programme",
    familySeats: (count) => `${count} ${count === 1 ? "seat" : "seats"} for your registration`,
    selected: "Booked",
    available: "Available",
    full: "Full",
    conflict: "Overlaps a forum you already chose",
    book: "Book",
    booking: "Booking…",
    cancel: "Cancel booking",
    cancelling: "Cancelling…",
    section: "Seat type",
    liveAvailability: "Availability is checked again when you confirm.",
    savedBooked: "Forum booking confirmed.",
    savedCancelled: "Forum booking cancelled.",
    errors: {
      full: "The seats you need have become unavailable. Choose another forum.",
      overlap: "This forum overlaps one you have already chosen.",
      unavailable: "This forum is no longer available for booking.",
      forbidden: "You cannot change this registration.",
      "not-found": "The forum or registration is no longer available.",
      invalid: "The request is invalid.",
      failed: "Your choice could not be updated. Please try again.",
    },
  },
  fr: {
    title: "Choisis tes forums",
    empty: "Aucun forum n'est actuellement disponible pour l'inscription individuelle.",
    selectedTitle: "Tes forums",
    availableTitle: "Programme disponible",
    familySeats: (count) => `${count} ${count === 1 ? "place" : "places"} pour ton inscription`,
    selected: "Inscrit",
    available: "Disponible",
    full: "Complet",
    conflict: "Chevauche un forum déjà choisi",
    book: "S'inscrire",
    booking: "Inscription…",
    cancel: "Annuler l'inscription",
    cancelling: "Annulation…",
    section: "Type de place",
    liveAvailability: "La disponibilité est vérifiée à nouveau lors de la confirmation.",
    savedBooked: "Inscription au forum confirmée.",
    savedCancelled: "Inscription au forum annulée.",
    errors: {
      full: "Les places nécessaires viennent d'être épuisées. Choisis un autre forum.",
      overlap: "Ce forum chevauche un forum déjà choisi.",
      unavailable: "Ce forum n'est plus disponible.",
      forbidden: "Tu ne peux pas modifier cette inscription.",
      "not-found": "Le forum ou l'inscription n'est plus disponible.",
      invalid: "La demande n'est pas valide.",
      failed: "Impossible de mettre à jour ton choix. Réessaie.",
    },
  },
  de: {
    title: "Wähle deine Foren",
    empty: "Derzeit sind keine Foren für Einzelbuchungen verfügbar.",
    selectedTitle: "Deine Foren",
    availableTitle: "Verfügbares Programm",
    familySeats: (count) => `${count} ${count === 1 ? "Platz" : "Plätze"} für deine Anmeldung`,
    selected: "Gebucht",
    available: "Verfügbar",
    full: "Ausgebucht",
    conflict: "Überschneidet sich mit einem gewählten Forum",
    book: "Buchen",
    booking: "Wird gebucht…",
    cancel: "Buchung stornieren",
    cancelling: "Wird storniert…",
    section: "Platzart",
    liveAvailability: "Die Verfügbarkeit wird bei der Bestätigung erneut geprüft.",
    savedBooked: "Forum-Buchung bestätigt.",
    savedCancelled: "Forum-Buchung storniert.",
    errors: {
      full: "Die benötigten Plätze sind inzwischen vergeben. Wähle ein anderes Forum.",
      overlap: "Dieses Forum überschneidet sich mit einem bereits gewählten Forum.",
      unavailable: "Dieses Forum ist nicht mehr buchbar.",
      forbidden: "Du kannst diese Anmeldung nicht ändern.",
      "not-found": "Forum oder Anmeldung ist nicht mehr verfügbar.",
      invalid: "Die Anfrage ist ungültig.",
      failed: "Die Auswahl konnte nicht aktualisiert werden. Versuche es erneut.",
    },
  },
  es: {
    title: "Elige tus foros",
    empty: "Ahora mismo no hay foros disponibles para inscripción individual.",
    selectedTitle: "Tus foros",
    availableTitle: "Programa disponible",
    familySeats: (count) => `${count} ${count === 1 ? "plaza" : "plazas"} para tu inscripción`,
    selected: "Inscrito",
    available: "Disponible",
    full: "Completo",
    conflict: "Coincide con un foro ya elegido",
    book: "Inscribirse",
    booking: "Inscribiendo…",
    cancel: "Cancelar inscripción",
    cancelling: "Cancelando…",
    section: "Tipo de plaza",
    liveAvailability: "La disponibilidad se vuelve a comprobar al confirmar.",
    savedBooked: "Inscripción al foro confirmada.",
    savedCancelled: "Inscripción al foro cancelada.",
    errors: {
      full: "Las plazas necesarias se han agotado. Elige otro foro.",
      overlap: "Este foro coincide con otro que ya has elegido.",
      unavailable: "Este foro ya no está disponible.",
      forbidden: "No puedes modificar esta inscripción.",
      "not-found": "El foro o la inscripción ya no están disponibles.",
      invalid: "La solicitud no es válida.",
      failed: "No se pudo actualizar la elección. Inténtalo de nuevo.",
    },
  },
  nl: {
    title: "Kies je forums",
    empty: "Er zijn momenteel geen forums beschikbaar voor individuele boeking.",
    selectedTitle: "Jouw forums",
    availableTitle: "Beschikbaar programma",
    familySeats: (count) => `${count} ${count === 1 ? "plaats" : "plaatsen"} voor je inschrijving`,
    selected: "Geboekt",
    available: "Beschikbaar",
    full: "Vol",
    conflict: "Overlapt met een gekozen forum",
    book: "Boeken",
    booking: "Boeken…",
    cancel: "Boeking annuleren",
    cancelling: "Annuleren…",
    section: "Plaastype",
    liveAvailability: "De beschikbaarheid wordt bij de bevestiging opnieuw gecontroleerd.",
    savedBooked: "Forumboeking bevestigd.",
    savedCancelled: "Forumboeking geannuleerd.",
    errors: {
      full: "De benodigde plaatsen zijn inmiddels vol. Kies een ander forum.",
      overlap: "Dit forum overlapt met een forum dat je al koos.",
      unavailable: "Dit forum is niet meer beschikbaar.",
      forbidden: "Je kunt deze inschrijving niet wijzigen.",
      "not-found": "Het forum of de inschrijving is niet meer beschikbaar.",
      invalid: "Het verzoek is ongeldig.",
      failed: "Je keuze kon niet worden bijgewerkt. Probeer opnieuw.",
    },
  },
  uk: {
    title: "Оберіть свої форуми",
    empty: "Наразі немає форумів для індивідуального бронювання.",
    selectedTitle: "Ваші форуми",
    availableTitle: "Доступна програма",
    familySeats: (count) => `${count} місць для вашої реєстрації`,
    selected: "Заброньовано",
    available: "Доступно",
    full: "Місць немає",
    conflict: "Збігається в часі з обраним форумом",
    book: "Забронювати",
    booking: "Бронювання…",
    cancel: "Скасувати бронювання",
    cancelling: "Скасування…",
    section: "Тип місця",
    liveAvailability: "Доступність перевіряється повторно під час підтвердження.",
    savedBooked: "Бронювання форуму підтверджено.",
    savedCancelled: "Бронювання форуму скасовано.",
    errors: {
      full: "Потрібні місця щойно закінчилися. Оберіть інший форум.",
      overlap: "Цей форум збігається в часі з уже обраним форумом.",
      unavailable: "Цей форум більше недоступний.",
      forbidden: "Ви не можете змінювати цю реєстрацію.",
      "not-found": "Форум або реєстрація більше недоступна.",
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
  requestedForum?: string | null;
};

export function ParticipantPanelBookings({ locale, registrationId, rows: initialRows, saved, error, requestedForum }: Props) {
  const { rows, error: refreshError } = useForumAvailability(registrationId, initialRows);
  const waitlistCopy = FORUM_WAITLIST_COPY[locale] ?? FORUM_WAITLIST_COPY.en;
  const baseCopy = COPY[locale] ?? COPY.en;
  const copy: Copy = { ...baseCopy, conflict: waitlistCopy.conflict, errors: { ...baseCopy.errors, attendance: FORUM_ATTENDANCE_COPY[locale].error, overlap: waitlistCopy.overlap, expired: waitlistCopy.expired, available: waitlistCopy.available } };
  const sectionsByPanel = new Map<string, { first: string; count: number }>();
  for (const row of rows) {
    const entry = sectionsByPanel.get(row.panel_id);
    if (entry) entry.count++;
    else sectionsByPanel.set(row.panel_id, { first: row.section_id, count: 1 });
  }
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
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--peace-muted)]">{FORUM_CHILD_COPY[locale].help}</p>
        <p className="mt-3 rounded-lg border border-[var(--peace-border)] bg-[var(--peace-sky-100)] p-4 text-sm leading-6 text-[var(--peace-blue-950)]">{waitlistCopy.rule}</p>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--peace-muted)]">{waitlistCopy.queueHelp}</p>
      </div>

      {saved ? (
        <p role="status" className="rounded-md border border-[#b9d5bd] bg-[#f0f8ed] px-3 py-2 text-sm text-[#315e3b]">
          {saved === "booked" ? copy.savedBooked : saved === "queued" ? waitlistCopy.savedQueued : saved === "left" ? waitlistCopy.savedLeft : copy.savedCancelled}
        </p>
      ) : null}
      {error || refreshError ? (
        <p role="alert" className="rounded-md border border-[#e0b5a9] bg-[#fff3ef] px-3 py-2 text-sm text-[#8a3323]">
          {copy.errors[error ?? refreshError ?? "failed"] ?? copy.errors.failed}
          {error === "attendance" ? <Link prefetch={false} className="mt-2 block font-semibold underline" href="/dashboard/partecipante?overlay=iscrizione&editAttendance=1#declared-attendance">{FORUM_ATTENDANCE_COPY[locale].edit}</Link> : null}
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
                  <PanelBookingCard requested={row.panel_id === requestedForum} anchor={row.panel_id === requestedForum && sectionsByPanel.get(row.panel_id)?.first === row.section_id} copy={copy} locale={locale} registrationId={registrationId} row={row} key={row.section_id} showAudience={(sectionsByPanel.get(row.panel_id)?.count ?? 0) > 1} />
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

function PanelBookingCard({ copy, locale, registrationId, row, showAudience, requested, anchor }: {
  anchor: boolean;
  requested: boolean;
  copy: Copy;
  locale: SupportedLocale;
  registrationId: string;
  row: ParticipantPanelCatalogRow;
  showAudience: boolean;
}) {
  const isSelected = row.booking_status === "selected";
  const queueCopy = FORUM_WAITLIST_COPY[locale];
  const isQueued = row.booking_status === "queued";
  const isOffered = row.booking_status === "offered";
  const [draftIds, setDraftIds] = useState<string[] | null>(null);
  const locked = isSelected || isQueued || isOffered;
  const childIds = locked ? (row.children ?? []).filter(c => c.selected).map(c => c.id) : draftIds ?? (row.children ?? []).filter(c => c.selected).map(c => c.id);
  const seats = locked ? row.party_size : 1 + childIds.length;
  const isFull = !locked && (row.has_waiting || (row.remaining_seats !== undefined ? seats > row.remaining_seats : row.booking_status === "full"));
  const disabled = (row.has_slot_conflict || row.booking_status === "conflict") && !isFull;
  const intent = isSelected ? "cancel" : isQueued ? "leave" : isOffered ? "accept" : isFull ? "join" : "book";
  const buttonLabel = isSelected ? copy.cancel : isQueued ? queueCopy.leave : isOffered ? queueCopy.accept : isFull ? queueCopy.join : copy.book;
  const statusLabel = isSelected
    ? copy.selected
    : isQueued ? queueCopy.queued
    : isOffered ? queueCopy.offered
    : isFull
      ? copy.full
      : disabled
        ? copy.conflict
        : copy.available;

  return (
    <article id={anchor ? `forum-${row.panel_id}` : `forum-${row.panel_id}-${row.section_id}`} className={`scroll-mt-24 grid gap-4 rounded-xl border bg-white p-5 ${requested ? "ring-2 ring-[var(--peace-blue-700)] ring-offset-2 " : ""}${isSelected ? "border-[#8fc99a] shadow-[0_10px_30px_rgba(41,104,61,0.08)]" : "border-[var(--peace-border)]"}`}>
      {requested ? <p className="text-sm font-bold text-[var(--peace-blue-800)]">{getEventProgramCopy(locale).selectedForum}</p> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h4 className="text-lg font-bold text-[var(--peace-blue-950)]">{row.title}</h4>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${isSelected ? "bg-[#e8f6e8] text-[#27613a]" : row.booking_status === "available" ? "bg-[var(--peace-sky-100)] text-[var(--peace-blue-800)]" : "bg-[#fff0eb] text-[#8a3323]"}`}>
          {isSelected ? <CheckCircle2 aria-hidden="true" className="mr-1 inline size-3.5" /> : null}
          {statusLabel}
        </span>
      </div>
      <ForumLanguages panelId={row.panel_id} locale={locale} />
      {row.description ? <p className="text-sm leading-6 text-[var(--peace-muted)]">{row.description}</p> : null}
      <dl className="grid gap-2 text-sm text-[var(--peace-ink)]">
        <div className="flex items-start gap-2"><CalendarDays aria-hidden="true" className="mt-0.5 size-4 text-[var(--peace-blue-700)]" /><span>{formatDate(row.starts_at, locale)}</span></div>
        <div className="flex items-start gap-2"><Clock3 aria-hidden="true" className="mt-0.5 size-4 text-[var(--peace-blue-700)]" /><span>{formatTimeRange(row.starts_at, row.ends_at, locale)}</span></div>
        <div className="flex items-start gap-2"><MapPin aria-hidden="true" className="mt-0.5 size-4 text-[var(--peace-blue-700)]" /><span><strong>{row.location_name}</strong>{row.location_address ? ` · ${row.location_address}` : ""}</span></div>
        <div className="flex items-start gap-2"><Users aria-hidden="true" className="mt-0.5 size-4 text-[var(--peace-blue-700)]" /><span>{copy.familySeats(seats)}</span></div>
        {showAudience ? <div><dt className="inline font-semibold">{copy.section}: </dt><dd className="inline">{row.audience_name}</dd></div> : null}
      </dl>
      {isQueued && row.queue_position ? <p className="text-sm font-semibold">{queueCopy.position}: {row.queue_position}</p> : null}
      {isOffered && row.offer_expires_at ? <div className="grid gap-2 rounded-lg border border-[#b9d5bd] bg-[#f0f8ed] p-3 text-sm leading-6">
        <p className="font-bold">{queueCopy.deadline}: {new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }).format(new Date(row.offer_expires_at))} (Europe/Rome)</p>
        <p>{queueCopy.swap}</p>
      </div> : null}
      {row.booking_status === "available" ? <p className="text-sm leading-6 text-[var(--peace-muted)]">{queueCopy.bookingRule}</p> : null}
      {isFull ? <p className="text-sm leading-6 text-[var(--peace-muted)]">{queueCopy.queueHelp}</p> : null}
      <form action={setParticipantPanelBooking}>
        <ForumChildSelection options={row.children ?? []} selected={childIds} onChange={setDraftIds} locale={locale} locked={locked} />
        <input type="hidden" name="registrationId" value={registrationId} />
        <input type="hidden" name="panelId" value={row.panel_id} />
        <input type="hidden" name="sectionId" value={row.section_id} />
        <input type="hidden" name="intent" value={intent} />
        <PendingSubmitButton disabled={disabled} pendingLabel={isSelected ? copy.cancelling : copy.booking} className={`min-h-11 w-full rounded-md px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:bg-[#d9e0e6] disabled:text-[#637181] ${isSelected ? "border border-[#cf9b8e] text-[#8a3323] hover:bg-[#fff3ef]" : "bg-[var(--peace-blue-800)] text-white hover:bg-[var(--peace-blue-900)]"}`}>
          {buttonLabel}
        </PendingSubmitButton>
      </form>
      {isOffered ? <form action={setParticipantPanelBooking}>
        <input type="hidden" name="registrationId" value={registrationId} />
        <input type="hidden" name="panelId" value={row.panel_id} />
        <input type="hidden" name="sectionId" value={row.section_id} />
        <input type="hidden" name="intent" value="leave" />
        <PendingSubmitButton pendingLabel={copy.cancelling} className="btn-secondary min-h-11 w-full">{queueCopy.leave}</PendingSubmitButton>
      </form> : null}
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
