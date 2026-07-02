import { redirect } from "next/navigation";
import Link from "next/link";

import { updateParticipantDashboard } from "@/app/actions";
import { DashboardRoleTabs } from "@/app/dashboard/role-tabs";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { getCurrentAuthContext } from "@/lib/auth/session";
import type { SupportedLocale } from "@/lib/i18n/config";
import { getRequestLocale } from "@/lib/i18n/server";
import { ACCESSIBILITY_DIFFICULTIES } from "@/lib/questionnaire/registration";
import { renderQrDataUrl } from "@/lib/qrcode/render";
import { decryptQrToken } from "@/lib/qrcode/secure-token";
import { canParticipantEditRegistration } from "@/lib/registrations/participant-dashboard";
import {
  ATTENDANCE_PARTS,
  buildAttendanceDayColumns,
  encodeAttendanceSlot,
  attendanceSlotKey,
  type AttendancePart,
  type AttendanceSlot,
} from "@/lib/registrations/attendance-slots";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type DashboardOverlay = "qr" | "iscrizione" | null;

type RegistrationRow = {
  id: string;
  event_id: string;
  participant_id: string;
  status: string;
  submitted_at: string;
  events: Related<EventRow>;
  participants: Related<ParticipantRow>;
};

type EventRow = {
  id: string;
  title: string;
  slug: string;
  city: string;
  country: string;
  starts_on: string | null;
  ends_on: string | null;
  registration_closes_at: string | null;
};

type ParticipantRow = {
  auth_user_id: string | null;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  country_other: string | null;
  city_other: string | null;
  has_previous_santegidio_participation: boolean | null;
  participates_with_group: boolean | null;
  public_code: string | null;
};

type Related<T> = T | T[] | null;

type ContactRow = {
  id: string;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
};

type AccessibilityRow = {
  washington_group_answers: Record<string, boolean> | null;
  needs_operational_support: boolean;
  operational_notes: string | null;
};

type AttendanceRow = {
  day: string | null;
  day_part: "morning" | "afternoon" | null;
  choice: "yes" | "no" | "unknown";
};

type MomentRow = {
  id: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
};

type MomentChoiceRow = {
  moment_id: string;
  choice: "yes" | "no" | "unknown";
};

type GroupAssignmentRow = {
  status: string;
  groups: Related<{
    name: string;
    primary_leader_name: string | null;
  }>;
};

type QuestionnaireRow = {
  questionnaire_version: string;
  answers: {
    birthPlace?: string | null;
    nationality?: string | null;
    groupParticipation?: {
      participatesWithGroup?: boolean | null;
      groupName?: string | null;
    };
  } | null;
};

type QrStatusRow = {
  status: string;
  expires_at: string | null;
  token_encrypted: string | null;
};

type ParticipantDashboardCopy = {
  area: string;
  fallbackTitle: string;
  verifiedAccess: (email: string) => string;
  group: string;
  leader: string;
  noGroup: string;
  saved: string;
  noRegistrationTitle: string;
  noRegistrationBody: string;
  startRegistration: string;
  qrTitle: string;
  qrBody: string;
  openRegistration: string;
  panelsTitle: string;
  panelsEmpty: string;
  qrEyebrow: string;
  qrOverlayBody: string;
  qrStatus: string;
  yourCode: string;
  collapse: string;
  expand: string;
  registrationSummary: string;
  registrationSummaryBody: (eventTitle: string, dateRange: string) => string;
  submittedAt: string;
  phone: string;
  birthDate: string;
  birthPlace: string;
  nationality: string;
  expectedPresence: string;
  accessibilitySupport: string;
  attendanceUnknown: string;
  attendanceUnknownSummary: string;
  accessibilityRequest: string;
  accessibilityTitle: string;
  accessibilityHelp: string;
  accessibilityNotes: string;
  editClosed: string;
  notProvided: string;
  notAssigned: string;
  datesToConfirm: string;
  fromTo: (from: string, to: string) => string;
  supportRequested: string;
  supportNotRequested: string;
  save: string;
  edit: string;
  editUnavailable: string;
  qrActive: string;
  qrInactive: string;
  active: string;
  activeUntil: (date: string) => string;
  revoked: string;
  expired: string;
  preparing: string;
  downloadImage: string;
  addToWallet: string;
  availableLater: string;
  close: string;
  personalQrAlt: string;
  personalQrFile: string;
  errors: Record<string, string>;
  fallbackError: string;
};

const PARTICIPANT_DASHBOARD_COPY: Record<SupportedLocale, ParticipantDashboardCopy> = {
  it: {
    area: "Area partecipante",
    fallbackTitle: "Dashboard partecipante",
    verifiedAccess: (email) => `Accesso verificato per ${email}.`,
    group: "Gruppo",
    leader: "Referente",
    noGroup: "Nessun gruppo collegato a questa iscrizione.",
    saved: "Modifiche salvate.",
    noRegistrationTitle: "Nessuna iscrizione collegata",
    noRegistrationBody:
      "Questa sessione non risulta collegata a un partecipante. Usa il magic link ricevuto via email o avvia di nuovo l'accesso dalla home.",
    startRegistration: "Avvia la mia iscrizione",
    qrTitle: "Il tuo QR code personale",
    qrBody:
      "Tienilo a portata di mano per l'accesso all'evento e ai panel. Se il QR non fosse disponibile, comunica il tuo codice partecipante all'accoglienza.",
    openRegistration: "Visualizza e modifica la tua iscrizione",
    panelsTitle: "Panel a cui sei iscritto",
    panelsEmpty:
      "I panel non sono ancora disponibili per l'iscrizione dalla dashboard. Quando ti iscriverai a un panel, qui compariranno titolo, data, ora e informazioni operative.",
    qrEyebrow: "QR code evento",
    qrOverlayBody:
      "Usa questo QR code per l'accesso all'evento quando l'accoglienza abiliterà la scansione. Il codice partecipante resta il riferimento operativo da comunicare se il QR non fosse disponibile.",
    qrStatus: "Stato QR",
    yourCode: "Il tuo codice",
    collapse: "Comprimi",
    expand: "Allarga",
    registrationSummary: "Riepilogo iscrizione",
    registrationSummaryBody: (eventTitle, dateRange) =>
      `Questo è il riepilogo della tua iscrizione per ${eventTitle}, che si terrà nei giorni ${dateRange}.`,
    submittedAt: "Iscrizione effettuata il",
    phone: "Telefono",
    birthDate: "Data di nascita",
    birthPlace: "Luogo di nascita",
    nationality: "Nazionalità",
    expectedPresence: "Presenza prevista",
    accessibilitySupport: "Accessibilità e supporto",
    attendanceUnknown: "Comunicherò più avanti i giorni di presenza.",
    attendanceUnknownSummary: "Da comunicare",
    accessibilityRequest: "Desidero richiedere supporto per l'accessibilità all'evento.",
    accessibilityTitle: "Quali aspetti dobbiamo considerare?",
    accessibilityHelp:
      "Puoi selezionare una o più opzioni utili per organizzare meglio l'accoglienza.",
    accessibilityNotes: "Indicazioni pratiche per l'organizzazione",
    editClosed: "La finestra di modifica non è attiva per questa iscrizione.",
    notProvided: "Non indicata",
    notAssigned: "Non assegnato",
    datesToConfirm: "Date da confermare",
    fromTo: (from, to) => `dal ${from} al ${to}`,
    supportRequested: "Supporto richiesto",
    supportNotRequested: "Nessun supporto richiesto",
    save: "Salva",
    edit: "Modifica",
    editUnavailable: "Modifica non disponibile",
    qrActive: "Il tuo QR code è attivo",
    qrInactive: "Il tuo QR code non è attivo",
    active: "Attivo",
    activeUntil: (date) => `Attivo fino al ${date}`,
    revoked: "Revocato",
    expired: "Scaduto",
    preparing: "In preparazione",
    downloadImage: "Scarica immagine",
    addToWallet: "Aggiungi al tuo wallet",
    availableLater: "Disponibile più avanti",
    close: "Chiudi",
    personalQrAlt: "QR code personale",
    personalQrFile: "personale",
    errors: {
      closed: "La finestra di modifica dell'iscrizione non è attiva.",
      "not-found": "Iscrizione non trovata per questa sessione.",
    },
    fallbackError: "Non è stato possibile salvare le modifiche.",
  },
  en: {
    area: "Participant area",
    fallbackTitle: "Participant dashboard",
    verifiedAccess: (email) => `Access verified for ${email}.`,
    group: "Group",
    leader: "Contact person",
    noGroup: "No group is linked to this registration.",
    saved: "Changes saved.",
    noRegistrationTitle: "No linked registration",
    noRegistrationBody:
      "This session is not linked to a participant. Use the magic link received by email or start access again from the home page.",
    startRegistration: "Start my registration",
    qrTitle: "Your personal QR code",
    qrBody:
      "Keep it handy for access to the event and panels. If the QR code is not available, give your participant code to the welcome desk.",
    openRegistration: "View and edit your registration",
    panelsTitle: "Panels you are registered for",
    panelsEmpty:
      "Panels are not yet available for registration from the dashboard. When you register for a panel, its title, date, time and operational information will appear here.",
    qrEyebrow: "Event QR code",
    qrOverlayBody:
      "Use this QR code to access the event when scanning is enabled at the welcome desk. Your participant code remains the operational reference to share if the QR code is not available.",
    qrStatus: "QR status",
    yourCode: "Your code",
    collapse: "Collapse",
    expand: "Expand",
    registrationSummary: "Registration summary",
    registrationSummaryBody: (eventTitle, dateRange) =>
      `This is the summary of your registration for ${eventTitle}, taking place on ${dateRange}.`,
    submittedAt: "Registration submitted on",
    phone: "Phone",
    birthDate: "Date of birth",
    birthPlace: "Place of birth",
    nationality: "Nationality",
    expectedPresence: "Expected attendance",
    accessibilitySupport: "Accessibility and support",
    attendanceUnknown: "I will communicate my attendance days later.",
    attendanceUnknownSummary: "To be communicated",
    accessibilityRequest: "I would like to request accessibility support for the event.",
    accessibilityTitle: "Which aspects should we consider?",
    accessibilityHelp:
      "You can select one or more options that are useful for organising the welcome better.",
    accessibilityNotes: "Practical notes for the organisation",
    editClosed: "The edit window is not active for this registration.",
    notProvided: "Not provided",
    notAssigned: "Not assigned",
    datesToConfirm: "Dates to be confirmed",
    fromTo: (from, to) => `from ${from} to ${to}`,
    supportRequested: "Support requested",
    supportNotRequested: "No support requested",
    save: "Save",
    edit: "Edit",
    editUnavailable: "Editing not available",
    qrActive: "Your QR code is active",
    qrInactive: "Your QR code is not active",
    active: "Active",
    activeUntil: (date) => `Active until ${date}`,
    revoked: "Revoked",
    expired: "Expired",
    preparing: "In preparation",
    downloadImage: "Download image",
    addToWallet: "Add to your wallet",
    availableLater: "Available later",
    close: "Close",
    personalQrAlt: "Personal QR code",
    personalQrFile: "personal",
    errors: {
      closed: "The registration edit window is not active.",
      "not-found": "Registration not found for this session.",
    },
    fallbackError: "The changes could not be saved.",
  },
  fr: {
    area: "Espace participant",
    fallbackTitle: "Dashboard participant",
    verifiedAccess: (email) => `Accès vérifié pour ${email}.`,
    group: "Groupe",
    leader: "Référent",
    noGroup: "Aucun groupe n'est lié à cette inscription.",
    saved: "Modifications enregistrées.",
    noRegistrationTitle: "Aucune inscription liée",
    noRegistrationBody:
      "Cette session n'est pas liée à un participant. Utilise le magic link reçu par email ou recommence l'accès depuis l'accueil.",
    startRegistration: "Commencer mon inscription",
    qrTitle: "Ton QR code personnel",
    qrBody:
      "Garde-le à portée de main pour l'accès à l'événement et aux panels. Si le QR n'est pas disponible, communique ton code participant à l'accueil.",
    openRegistration: "Voir et modifier ton inscription",
    panelsTitle: "Panels auxquels tu es inscrit",
    panelsEmpty:
      "Les panels ne sont pas encore disponibles pour l'inscription depuis le dashboard. Quand tu t'inscriras à un panel, le titre, la date, l'heure et les informations pratiques apparaîtront ici.",
    qrEyebrow: "QR code événement",
    qrOverlayBody:
      "Utilise ce QR code pour accéder à l'événement lorsque l'accueil activera le scan. Ton code participant reste la référence à communiquer si le QR n'est pas disponible.",
    qrStatus: "État du QR",
    yourCode: "Ton code",
    collapse: "Réduire",
    expand: "Agrandir",
    registrationSummary: "Résumé de l'inscription",
    registrationSummaryBody: (eventTitle, dateRange) =>
      `Voici le résumé de ton inscription à ${eventTitle}, qui aura lieu ${dateRange}.`,
    submittedAt: "Inscription effectuée le",
    phone: "Téléphone",
    birthDate: "Date de naissance",
    birthPlace: "Lieu de naissance",
    nationality: "Nationalité",
    expectedPresence: "Présence prévue",
    accessibilitySupport: "Accessibilité et support",
    attendanceUnknown: "Je communiquerai plus tard mes jours de présence.",
    attendanceUnknownSummary: "À communiquer",
    accessibilityRequest: "Je souhaite demander un support d'accessibilité pour l'événement.",
    accessibilityTitle: "Quels aspects devons-nous prendre en compte ?",
    accessibilityHelp:
      "Tu peux sélectionner une ou plusieurs options utiles pour mieux organiser l'accueil.",
    accessibilityNotes: "Indications pratiques pour l'organisation",
    editClosed: "La fenêtre de modification n'est pas active pour cette inscription.",
    notProvided: "Non indiqué",
    notAssigned: "Non attribué",
    datesToConfirm: "Dates à confirmer",
    fromTo: (from, to) => `du ${from} au ${to}`,
    supportRequested: "Support demandé",
    supportNotRequested: "Aucun support demandé",
    save: "Enregistrer",
    edit: "Modifier",
    editUnavailable: "Modification non disponible",
    qrActive: "Ton QR code est actif",
    qrInactive: "Ton QR code n'est pas actif",
    active: "Actif",
    activeUntil: (date) => `Actif jusqu'au ${date}`,
    revoked: "Révoqué",
    expired: "Expiré",
    preparing: "En préparation",
    downloadImage: "Télécharger l'image",
    addToWallet: "Ajouter à ton wallet",
    availableLater: "Disponible plus tard",
    close: "Fermer",
    personalQrAlt: "QR code personnel",
    personalQrFile: "personnel",
    errors: {
      closed: "La fenêtre de modification de l'inscription n'est pas active.",
      "not-found": "Inscription introuvable pour cette session.",
    },
    fallbackError: "Impossible d'enregistrer les modifications.",
  },
  de: {
    area: "Teilnehmendenbereich",
    fallbackTitle: "Teilnehmenden-Dashboard",
    verifiedAccess: (email) => `Zugang bestätigt für ${email}.`,
    group: "Gruppe",
    leader: "Kontaktperson",
    noGroup: "Mit dieser Anmeldung ist keine Gruppe verbunden.",
    saved: "Änderungen gespeichert.",
    noRegistrationTitle: "Keine verknüpfte Anmeldung",
    noRegistrationBody:
      "Diese Sitzung ist nicht mit einer teilnehmenden Person verknüpft. Nutze den Magic Link aus der E-Mail oder starte den Zugang erneut über die Startseite.",
    startRegistration: "Meine Anmeldung starten",
    qrTitle: "Dein persönlicher QR-Code",
    qrBody:
      "Halte ihn für den Zugang zur Veranstaltung und zu den Panels bereit. Wenn der QR-Code nicht verfügbar ist, teile dem Empfang deinen Teilnehmendencode mit.",
    openRegistration: "Deine Anmeldung anzeigen und bearbeiten",
    panelsTitle: "Panels, für die du angemeldet bist",
    panelsEmpty:
      "Panels sind im Dashboard noch nicht zur Anmeldung verfügbar. Wenn du dich für ein Panel anmeldest, erscheinen hier Titel, Datum, Uhrzeit und praktische Informationen.",
    qrEyebrow: "Veranstaltungs-QR-Code",
    qrOverlayBody:
      "Nutze diesen QR-Code für den Zugang zur Veranstaltung, sobald der Empfang das Scannen aktiviert. Dein Teilnehmendencode bleibt die Referenz, falls der QR-Code nicht verfügbar ist.",
    qrStatus: "QR-Status",
    yourCode: "Dein Code",
    collapse: "Einklappen",
    expand: "Erweitern",
    registrationSummary: "Anmeldungsübersicht",
    registrationSummaryBody: (eventTitle, dateRange) =>
      `Dies ist die Übersicht deiner Anmeldung für ${eventTitle}, die ${dateRange} stattfindet.`,
    submittedAt: "Anmeldung eingereicht am",
    phone: "Telefon",
    birthDate: "Geburtsdatum",
    birthPlace: "Geburtsort",
    nationality: "Staatsangehörigkeit",
    expectedPresence: "Geplante Anwesenheit",
    accessibilitySupport: "Barrierefreiheit und Unterstützung",
    attendanceUnknown: "Ich teile meine Anwesenheitstage später mit.",
    attendanceUnknownSummary: "Noch mitzuteilen",
    accessibilityRequest: "Ich möchte Unterstützung für Barrierefreiheit bei der Veranstaltung anfragen.",
    accessibilityTitle: "Welche Aspekte sollen wir berücksichtigen?",
    accessibilityHelp:
      "Du kannst eine oder mehrere Optionen auswählen, die für die Organisation des Empfangs hilfreich sind.",
    accessibilityNotes: "Praktische Hinweise für die Organisation",
    editClosed: "Das Bearbeitungsfenster ist für diese Anmeldung nicht aktiv.",
    notProvided: "Nicht angegeben",
    notAssigned: "Nicht zugewiesen",
    datesToConfirm: "Termine werden noch bestätigt",
    fromTo: (from, to) => `vom ${from} bis ${to}`,
    supportRequested: "Unterstützung angefragt",
    supportNotRequested: "Keine Unterstützung angefragt",
    save: "Speichern",
    edit: "Bearbeiten",
    editUnavailable: "Bearbeitung nicht verfügbar",
    qrActive: "Dein QR-Code ist aktiv",
    qrInactive: "Dein QR-Code ist nicht aktiv",
    active: "Aktiv",
    activeUntil: (date) => `Aktiv bis ${date}`,
    revoked: "Widerrufen",
    expired: "Abgelaufen",
    preparing: "In Vorbereitung",
    downloadImage: "Bild herunterladen",
    addToWallet: "Zum Wallet hinzufügen",
    availableLater: "Später verfügbar",
    close: "Schließen",
    personalQrAlt: "Persönlicher QR-Code",
    personalQrFile: "persoenlich",
    errors: {
      closed: "Das Bearbeitungsfenster der Anmeldung ist nicht aktiv.",
      "not-found": "Für diese Sitzung wurde keine Anmeldung gefunden.",
    },
    fallbackError: "Die Änderungen konnten nicht gespeichert werden.",
  },
  es: {
    area: "Área participante",
    fallbackTitle: "Panel participante",
    verifiedAccess: (email) => `Acceso verificado para ${email}.`,
    group: "Grupo",
    leader: "Referente",
    noGroup: "No hay ningún grupo vinculado a esta inscripción.",
    saved: "Cambios guardados.",
    noRegistrationTitle: "No hay inscripción vinculada",
    noRegistrationBody:
      "Esta sesión no está vinculada a un participante. Usa el magic link recibido por email o inicia de nuevo el acceso desde el inicio.",
    startRegistration: "Iniciar mi inscripción",
    qrTitle: "Tu código QR personal",
    qrBody:
      "Tenlo a mano para el acceso al evento y a los paneles. Si el QR no estuviera disponible, comunica tu código de participante en la acogida.",
    openRegistration: "Ver y modificar tu inscripción",
    panelsTitle: "Paneles a los que estás inscrito",
    panelsEmpty:
      "Los paneles todavía no están disponibles para inscripción desde el panel. Cuando te inscribas a un panel, aquí aparecerán título, fecha, hora e información operativa.",
    qrEyebrow: "Código QR del evento",
    qrOverlayBody:
      "Usa este código QR para acceder al evento cuando la acogida active el escaneo. Tu código de participante sigue siendo la referencia operativa si el QR no está disponible.",
    qrStatus: "Estado QR",
    yourCode: "Tu código",
    collapse: "Contraer",
    expand: "Ampliar",
    registrationSummary: "Resumen de inscripción",
    registrationSummaryBody: (eventTitle, dateRange) =>
      `Este es el resumen de tu inscripción para ${eventTitle}, que tendrá lugar ${dateRange}.`,
    submittedAt: "Inscripción realizada el",
    phone: "Teléfono",
    birthDate: "Fecha de nacimiento",
    birthPlace: "Lugar de nacimiento",
    nationality: "Nacionalidad",
    expectedPresence: "Presencia prevista",
    accessibilitySupport: "Accesibilidad y apoyo",
    attendanceUnknown: "Comunicaré más adelante los días de presencia.",
    attendanceUnknownSummary: "Por comunicar",
    accessibilityRequest: "Quiero solicitar apoyo de accesibilidad para el evento.",
    accessibilityTitle: "¿Qué aspectos debemos tener en cuenta?",
    accessibilityHelp:
      "Puedes seleccionar una o más opciones útiles para organizar mejor la acogida.",
    accessibilityNotes: "Indicaciones prácticas para la organización",
    editClosed: "La ventana de modificación no está activa para esta inscripción.",
    notProvided: "No indicado",
    notAssigned: "No asignado",
    datesToConfirm: "Fechas por confirmar",
    fromTo: (from, to) => `del ${from} al ${to}`,
    supportRequested: "Apoyo solicitado",
    supportNotRequested: "No se solicitó apoyo",
    save: "Guardar",
    edit: "Modificar",
    editUnavailable: "Modificación no disponible",
    qrActive: "Tu código QR está activo",
    qrInactive: "Tu código QR no está activo",
    active: "Activo",
    activeUntil: (date) => `Activo hasta el ${date}`,
    revoked: "Revocado",
    expired: "Caducado",
    preparing: "En preparación",
    downloadImage: "Descargar imagen",
    addToWallet: "Añadir a tu wallet",
    availableLater: "Disponible más adelante",
    close: "Cerrar",
    personalQrAlt: "Código QR personal",
    personalQrFile: "personal",
    errors: {
      closed: "La ventana de modificación de la inscripción no está activa.",
      "not-found": "No se encontró una inscripción para esta sesión.",
    },
    fallbackError: "No se pudieron guardar los cambios.",
  },
  nl: {
    area: "Deelnemersomgeving",
    fallbackTitle: "Deelnemersdashboard",
    verifiedAccess: (email) => `Toegang bevestigd voor ${email}.`,
    group: "Groep",
    leader: "Contactpersoon",
    noGroup: "Er is geen groep aan deze inschrijving gekoppeld.",
    saved: "Wijzigingen opgeslagen.",
    noRegistrationTitle: "Geen gekoppelde inschrijving",
    noRegistrationBody:
      "Deze sessie is niet gekoppeld aan een deelnemer. Gebruik de magic link uit de e-mail of start de toegang opnieuw vanaf home.",
    startRegistration: "Mijn inschrijving starten",
    qrTitle: "Je persoonlijke QR-code",
    qrBody:
      "Houd deze bij de hand voor toegang tot het evenement en de panels. Als de QR-code niet beschikbaar is, geef je deelnemerscode door aan de ontvangst.",
    openRegistration: "Je inschrijving bekijken en wijzigen",
    panelsTitle: "Panels waarvoor je bent ingeschreven",
    panelsEmpty:
      "Panels zijn nog niet beschikbaar voor inschrijving vanuit het dashboard. Wanneer je je inschrijft voor een panel, verschijnen hier titel, datum, tijd en praktische informatie.",
    qrEyebrow: "QR-code evenement",
    qrOverlayBody:
      "Gebruik deze QR-code voor toegang tot het evenement wanneer de ontvangst het scannen inschakelt. Je deelnemerscode blijft de operationele referentie als de QR-code niet beschikbaar is.",
    qrStatus: "QR-status",
    yourCode: "Je code",
    collapse: "Samenvouwen",
    expand: "Uitvouwen",
    registrationSummary: "Inschrijvingsoverzicht",
    registrationSummaryBody: (eventTitle, dateRange) =>
      `Dit is het overzicht van je inschrijving voor ${eventTitle}, dat plaatsvindt ${dateRange}.`,
    submittedAt: "Inschrijving ingediend op",
    phone: "Telefoon",
    birthDate: "Geboortedatum",
    birthPlace: "Geboorteplaats",
    nationality: "Nationaliteit",
    expectedPresence: "Verwachte aanwezigheid",
    accessibilitySupport: "Toegankelijkheid en ondersteuning",
    attendanceUnknown: "Ik geef mijn aanwezigheidsdagen later door.",
    attendanceUnknownSummary: "Nog door te geven",
    accessibilityRequest: "Ik wil toegankelijkheidsondersteuning voor het evenement aanvragen.",
    accessibilityTitle: "Waar moeten we rekening mee houden?",
    accessibilityHelp:
      "Je kunt een of meer opties selecteren die nuttig zijn om de ontvangst beter te organiseren.",
    accessibilityNotes: "Praktische aanwijzingen voor de organisatie",
    editClosed: "Het wijzigingsvenster is niet actief voor deze inschrijving.",
    notProvided: "Niet aangegeven",
    notAssigned: "Niet toegewezen",
    datesToConfirm: "Data nog te bevestigen",
    fromTo: (from, to) => `van ${from} tot ${to}`,
    supportRequested: "Ondersteuning aangevraagd",
    supportNotRequested: "Geen ondersteuning aangevraagd",
    save: "Opslaan",
    edit: "Wijzigen",
    editUnavailable: "Wijzigen niet beschikbaar",
    qrActive: "Je QR-code is actief",
    qrInactive: "Je QR-code is niet actief",
    active: "Actief",
    activeUntil: (date) => `Actief tot ${date}`,
    revoked: "Ingetrokken",
    expired: "Verlopen",
    preparing: "In voorbereiding",
    downloadImage: "Afbeelding downloaden",
    addToWallet: "Aan je wallet toevoegen",
    availableLater: "Later beschikbaar",
    close: "Sluiten",
    personalQrAlt: "Persoonlijke QR-code",
    personalQrFile: "persoonlijk",
    errors: {
      closed: "Het wijzigingsvenster van de inschrijving is niet actief.",
      "not-found": "Geen inschrijving gevonden voor deze sessie.",
    },
    fallbackError: "De wijzigingen konden niet worden opgeslagen.",
  },
  uk: {
    area: "Зона учасника",
    fallbackTitle: "Панель учасника",
    verifiedAccess: (email) => `Доступ підтверджено для ${email}.`,
    group: "Група",
    leader: "Контактна особа",
    noGroup: "До цієї реєстрації не прив'язано жодної групи.",
    saved: "Зміни збережено.",
    noRegistrationTitle: "Немає пов'язаної реєстрації",
    noRegistrationBody:
      "Ця сесія не пов'язана з учасником. Скористайтеся magic link з електронного листа або почніть доступ знову з головної сторінки.",
    startRegistration: "Почати мою реєстрацію",
    qrTitle: "Ваш персональний QR-код",
    qrBody:
      "Тримайте його під рукою для доступу до події та панелей. Якщо QR-код недоступний, повідомте свій код учасника на прийомі.",
    openRegistration: "Переглянути і змінити вашу реєстрацію",
    panelsTitle: "Панелі, на які ви зареєстровані",
    panelsEmpty:
      "Панелі ще недоступні для реєстрації з панелі учасника. Коли ви зареєструєтеся на панель, тут з'являться назва, дата, час і практична інформація.",
    qrEyebrow: "QR-код події",
    qrOverlayBody:
      "Використовуйте цей QR-код для доступу до події, коли на прийомі буде увімкнено сканування. Ваш код учасника залишається робочим посиланням, якщо QR-код недоступний.",
    qrStatus: "Стан QR",
    yourCode: "Ваш код",
    collapse: "Згорнути",
    expand: "Розгорнути",
    registrationSummary: "Підсумок реєстрації",
    registrationSummaryBody: (eventTitle, dateRange) =>
      `Це підсумок вашої реєстрації на ${eventTitle}, що відбудеться ${dateRange}.`,
    submittedAt: "Реєстрацію подано",
    phone: "Телефон",
    birthDate: "Дата народження",
    birthPlace: "Місце народження",
    nationality: "Громадянство",
    expectedPresence: "Очікувана присутність",
    accessibilitySupport: "Доступність і підтримка",
    attendanceUnknown: "Я повідомлю дні присутності пізніше.",
    attendanceUnknownSummary: "Буде повідомлено",
    accessibilityRequest: "Я хочу попросити підтримку доступності для події.",
    accessibilityTitle: "Що нам потрібно врахувати?",
    accessibilityHelp:
      "Можна вибрати один або кілька варіантів, корисних для кращої організації прийому.",
    accessibilityNotes: "Практичні вказівки для організації",
    editClosed: "Вікно редагування для цієї реєстрації не активне.",
    notProvided: "Не вказано",
    notAssigned: "Не призначено",
    datesToConfirm: "Дати буде уточнено",
    fromTo: (from, to) => `з ${from} до ${to}`,
    supportRequested: "Підтримку запитано",
    supportNotRequested: "Підтримку не запитано",
    save: "Зберегти",
    edit: "Змінити",
    editUnavailable: "Редагування недоступне",
    qrActive: "Ваш QR-код активний",
    qrInactive: "Ваш QR-код не активний",
    active: "Активний",
    activeUntil: (date) => `Активний до ${date}`,
    revoked: "Відкликано",
    expired: "Термін дії минув",
    preparing: "Готується",
    downloadImage: "Завантажити зображення",
    addToWallet: "Додати до wallet",
    availableLater: "Буде доступно пізніше",
    close: "Закрити",
    personalQrAlt: "Персональний QR-код",
    personalQrFile: "personal",
    errors: {
      closed: "Вікно редагування реєстрації не активне.",
      "not-found": "Реєстрацію для цієї сесії не знайдено.",
    },
    fallbackError: "Не вдалося зберегти зміни.",
  },
};

export default async function PartecipanteDashboardPage({
  searchParams,
}: PageProps) {
  const locale = await getRequestLocale();
  const copy = PARTICIPANT_DASHBOARD_COPY[locale] ?? PARTICIPANT_DASHBOARD_COPY.en;
  const params = searchParams ? await searchParams : {};
  const activeOverlay = parseDashboardOverlay(firstParam(params.overlay));
  const supabase = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(supabase, "partecipante");

  if (!auth) {
    redirect("/login");
  }

  const { data: registrationData } = await supabase
    .from("registrations")
    .select(
      "id,event_id,participant_id,status,submitted_at,events!inner(id,title,slug,city,country,starts_on,ends_on,registration_closes_at,is_current),participants!inner(auth_user_id,first_name,last_name,birth_date,country_other,city_other,has_previous_santegidio_participation,participates_with_group,public_code)"
    )
    .eq("events.is_current", true)
    .order("submitted_at", { ascending: false });

  const registrations = ((registrationData ?? []) as RegistrationRow[]).filter(
    (registration) => relatedOne(registration.participants)?.auth_user_id === auth.user.id
  );
  const selectedRegistration = registrations[0] ?? null;
  const participant = selectedRegistration
    ? relatedOne(selectedRegistration.participants)
    : null;
  const event = selectedRegistration ? relatedOne(selectedRegistration.events) : null;

  const registrationId = selectedRegistration?.id;
  const participantId = selectedRegistration?.participant_id;
  const eventId = selectedRegistration?.event_id;

  const [
    contactsResult,
    accessibilityResult,
    attendanceResult,
    momentsResult,
    momentChoicesResult,
    groupAssignmentsResult,
    questionnaireResult,
    qrStatusResult,
  ] = registrationId && participantId && eventId
    ? await Promise.all([
        supabase
          .from("participant_contacts")
          .select("id,email,phone,is_primary")
          .eq("participant_id", participantId)
          .order("is_primary", { ascending: false }),
        supabase
          .from("accessibility_needs")
          .select("washington_group_answers,needs_operational_support,operational_notes")
          .eq("registration_id", registrationId)
          .maybeSingle(),
        supabase
          .from("event_attendance_choices")
          .select("day,day_part,choice")
          .eq("registration_id", registrationId)
          .order("day"),
        supabase
          .from("event_moments")
          .select("id,title,starts_at,ends_at")
          .eq("event_id", eventId)
          .eq("is_public", true)
          .order("starts_at"),
        supabase
          .from("moment_attendance_choices")
          .select("moment_id,choice")
          .eq("registration_id", registrationId),
        supabase
          .from("participant_group_assignments")
          .select("status,groups(name,primary_leader_name)")
          .eq("registration_id", registrationId),
        supabase
          .from("registration_questionnaire_answers")
          .select("questionnaire_version,answers")
          .eq("registration_id", registrationId)
          .order("created_at", { ascending: false })
          .limit(1),
        getQrStatus(registrationId),
      ])
    : [
        { data: [] },
        { data: null },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: null },
      ];

  const contacts = (contactsResult.data ?? []) as ContactRow[];
  const primaryContact = contacts[0] ?? null;
  const accessibility = accessibilityResult.data as AccessibilityRow | null;
  const attendanceChoices = (attendanceResult.data ?? []) as AttendanceRow[];
  const moments = (momentsResult.data ?? []) as MomentRow[];
  const momentChoices = (momentChoicesResult.data ?? []) as MomentChoiceRow[];
  const groupAssignments = (groupAssignmentsResult.data ??
    []) as GroupAssignmentRow[];
  const questionnaire =
    ((questionnaireResult.data ?? []) as QuestionnaireRow[])[0] ?? null;
  const qrStatus = qrStatusResult.data as QrStatusRow | null;
  const qrDataUrl = await getQrDataUrl(qrStatus);
  const editable =
    selectedRegistration &&
    canParticipantEditRegistration({
      status: selectedRegistration.status,
      events: event,
    });
  const attendanceDayColumns = buildAttendanceDayColumns(
    event?.starts_on ?? null,
    event?.ends_on ?? null,
    locale
  );
  const selectedAttendanceSlots = attendanceChoices
    .filter((choice) => choice.choice === "yes" && choice.day)
    .flatMap((choice) =>
      choice.day_part
        ? [{ day: choice.day as string, part: choice.day_part }]
        : (["morning", "afternoon"] as const).map((part) => ({
            day: choice.day as string,
            part,
          }))
    );
  const selectedAttendanceSlotKeys = new Set(
    selectedAttendanceSlots.map(attendanceSlotKey)
  );
  const availabilityUnknown =
    attendanceChoices.length === 0 ||
    attendanceChoices.some((choice) => choice.choice === "unknown");
  const momentChoiceById = new Map(
    momentChoices.map((choice) => [choice.moment_id, choice.choice])
  );
  const sensitiveNeedCount = Object.values(
    accessibility?.washington_group_answers ?? {}
  ).filter(Boolean).length;
  const hasAccessibilityRequest =
    Boolean(accessibility?.needs_operational_support) ||
    Boolean(accessibility?.operational_notes) ||
    sensitiveNeedCount > 0;
  const attendanceSummary = availabilityUnknown
    ? copy.attendanceUnknownSummary
    : formatAttendanceSlotSummary(
        attendanceDayColumns,
        selectedAttendanceSlotKeys,
        locale
      ) || copy.notProvided;
  const selectedPanels = moments.filter(
    (moment) => momentChoiceById.get(moment.id) === "yes"
  );
  const supportSummary = hasAccessibilityRequest
    ? copy.supportRequested
    : copy.supportNotRequested;
  const groupSummary = getGroupSummary(groupAssignments);

  return (
    <main className="app-page text-[var(--peace-ink)]">
      <section className="mx-auto grid w-full max-w-6xl gap-6 px-5 py-8 sm:px-8">
        <header className="grid gap-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--peace-blue-800)]">
            {copy.area}
          </p>
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
            <div>
              <h1 className="text-3xl font-semibold sm:text-4xl">
                {participant
                  ? `${participant.first_name} ${participant.last_name}`
                  : copy.fallbackTitle}
              </h1>
              {!event ? (
                <p className="mt-3 max-w-3xl text-[var(--peace-muted)]">
                  {copy.verifiedAccess(auth.user.email ?? "")}
                </p>
              ) : null}
              {participant && event && groupSummary ? (
                <p className="mt-2 flex flex-wrap gap-x-10 gap-y-1 text-sm leading-6 text-[#6f7f91]">
                  <span>
                    {copy.group}: <span>{groupSummary.name}</span>
                  </span>
                  {" "}
                  {groupSummary.leaderName ? (
                    <span>
                      {copy.leader}: <span>{groupSummary.leaderName}</span>
                    </span>
                  ) : null}
                </p>
              ) : participant && event ? (
                <p className="mt-2 text-sm leading-6 text-[#6f7f91]">
                  {copy.noGroup}
                </p>
              ) : null}
            </div>

            <div className="lg:flex lg:justify-end">
              <DashboardRoleTabs
                activeRole="partecipante"
                eventRoles={auth.eventRoles}
              />
            </div>
          </div>
          {params.saved ? (
            <p className="rounded-md border border-[#b9d5bd] bg-[#f0f8ed] px-3 py-2 text-sm text-[#315e3b]">
              {copy.saved}
            </p>
          ) : null}
          {params.error ? (
            <p className="rounded-md border border-[#e0b5a9] bg-[#fff3ef] px-3 py-2 text-sm text-[#8a3323]">
              {dashboardErrorMessage(firstParam(params.error), copy)}
            </p>
          ) : null}
        </header>

        {!selectedRegistration || !participant || !event ? (
          <section className="rounded-lg border border-[var(--peace-border)] bg-white p-5">
            <h2 className="text-lg font-semibold">{copy.noRegistrationTitle}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--peace-muted)]">
              {copy.noRegistrationBody}
            </p>
            <Link
              href={`/${auth.user.email ? `?email=${encodeURIComponent(auth.user.email)}` : ""}`}
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--peace-border-strong)] px-4 text-sm font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]"
            >
              {copy.startRegistration}
            </Link>
          </section>
        ) : (
          <>
            <section className="relative rounded-lg border border-[var(--peace-border)] bg-white p-5 pt-10 sm:p-6">
              <QrStatusIndicator active={qrStatus?.status === "active"} copy={copy} />
              <div className="grid gap-5 lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start">
                <div className="mx-auto grid w-full max-w-56 gap-3 lg:mx-0">
                  <QrPreview
                    participantCode={participant.public_code ?? ""}
                    qrDataUrl={qrDataUrl}
                    copy={copy}
                  />
                  <QrActionButtons
                    participantCode={participant.public_code}
                    qrDataUrl={qrDataUrl}
                    copy={copy}
                  />
                </div>
                <RegistrationSummaryCard
                  copy={copy}
                  participant={participant}
                  primaryContact={primaryContact}
                  questionnaire={questionnaire}
                  attendanceSummary={attendanceSummary}
                  supportSummary={supportSummary}
                  groupSummary={groupSummary}
                  selectedPanels={selectedPanels}
                  active={activeOverlay === "iscrizione"}
                  locale={locale}
                />
              </div>
            </section>

            <section className="grid gap-4">
              <Panel title={copy.panelsTitle}>
                {selectedPanels.length > 0 ? (
                  selectedPanels.map((panel) => (
                    <div
                      key={panel.id}
                      className="grid gap-1 border-b border-[var(--peace-border)] pb-3 last:border-b-0 last:pb-0"
                    >
                      <p className="font-medium">{panel.title}</p>
                      <p className="text-sm text-[#6f7f91]">
                        {formatDateTime(panel.starts_at, locale, copy)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm leading-6 text-[#6f7f91]">
                    {copy.panelsEmpty}
                  </p>
                )}
              </Panel>
            </section>

            {activeOverlay ? (
              <DashboardOverlay closeHref="/dashboard/partecipante" copy={copy}>
                {activeOverlay === "qr" ? (
                  <section className="grid gap-4 md:grid-cols-[14rem_1fr] md:items-center">
                    <QrPreview
                      participantCode={participant.public_code ?? ""}
                      qrDataUrl={qrDataUrl}
                      copy={copy}
                    />
                    <div className="grid gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#6f7f91]">
                          {copy.qrEyebrow}
                        </p>
                        <h2 className="mt-1 text-xl font-semibold">
                          {copy.qrTitle}
                        </h2>
                      </div>
                      <p className="text-sm leading-6 text-[var(--peace-muted)]">
                        {copy.qrOverlayBody}
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Info
                          label={copy.qrStatus}
                          value={
                            qrStatus ? qrStatusLabel(qrStatus, locale, copy) : copy.preparing
                          }
                        />
                        <Info
                          label={copy.yourCode}
                          value={participant.public_code ?? copy.notAssigned}
                        />
                      </div>
                    </div>
                  </section>
                ) : null}

                {activeOverlay === "iscrizione" ? (
                  <section className="grid gap-6">
                    <section className="flex flex-col gap-4">
                      <div className="border-b border-[var(--peace-border)] pb-2">
                        <h2 className="text-xl font-semibold">
                          {copy.registrationSummary}
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-[var(--peace-muted)]">
                          {copy.registrationSummaryBody(
                            event.title,
                            formatDateRange(event.starts_on, event.ends_on, locale, copy)
                          )}
                        </p>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <Info
                          label={copy.submittedAt}
                          value={formatDateTime(selectedRegistration.submitted_at, locale, copy)}
                        />
                        <Info
                          label="Email"
                          value={
                            primaryContact?.email ??
                            auth.user.email ??
                            copy.notProvided
                          }
                        />
                        <EditableInfo
                          label={copy.phone}
                          value={primaryContact?.phone ?? copy.notProvided}
                          editable={Boolean(editable)}
                          copy={copy}
                        >
                          <form
                            action={updateParticipantDashboard}
                            className="grid gap-3"
                          >
                            <BaseDashboardFields
                              registrationId={selectedRegistration.id}
                            />
                            <PreserveAttendance
                              availabilityUnknown={availabilityUnknown}
                              selectedSlots={selectedAttendanceSlots}
                            />
                            <PreserveMoments momentChoices={momentChoices} />
                            <Field label={copy.phone}>
                              <input
                                name="phone"
                                className="field"
                                defaultValue={primaryContact?.phone ?? ""}
                                placeholder="+3906000000"
                                autoComplete="tel"
                              />
                            </Field>
                            <SaveInlineButton editable={Boolean(editable)} copy={copy} />
                          </form>
                        </EditableInfo>
                        <Info
                          label={copy.birthDate}
                          value={formatDate(participant.birth_date, locale, copy)}
                        />
                        <Info
                          label={copy.birthPlace}
                          value={questionnaire?.answers?.birthPlace ?? copy.notProvided}
                        />
                        <Info
                          label={copy.nationality}
                          value={questionnaire?.answers?.nationality ?? copy.notProvided}
                        />
                      </div>

                      <EditableInfo
                        label={copy.expectedPresence}
                        value={attendanceSummary}
                        editable={Boolean(editable)}
                        copy={copy}
                      >
                        <form
                          action={updateParticipantDashboard}
                          className="grid gap-3"
                        >
                          <BaseDashboardFields
                            registrationId={selectedRegistration.id}
                          />
                          <PreservePhone value={primaryContact?.phone ?? null} />
                          <PreserveMoments momentChoices={momentChoices} />
                          <fieldset
                            disabled={!editable}
                            className="grid gap-3 disabled:opacity-70"
                          >
                            <label className="flex gap-3 rounded-md border border-[var(--peace-border)] p-3 text-sm">
                              <input
                                type="checkbox"
                                name="availabilityUnknown"
                                defaultChecked={availabilityUnknown}
                                className="mt-1"
                              />
                              <span>
                                {copy.attendanceUnknown}
                              </span>
                            </label>
                            <AttendanceSlotTable
                              columns={attendanceDayColumns}
                              selectedSlots={selectedAttendanceSlotKeys}
                              locale={locale}
                            />
                          </fieldset>
                          <SaveInlineButton editable={Boolean(editable)} copy={copy} />
                        </form>
                      </EditableInfo>

                      <EditableInfo
                        label={copy.accessibilitySupport}
                        value={
                          accessibility?.operational_notes
                            ? `${supportSummary}: ${accessibility.operational_notes}`
                            : supportSummary
                        }
                        editable={Boolean(editable)}
                        copy={copy}
                      >
                        <form
                          action={updateParticipantDashboard}
                          className="grid gap-3"
                        >
                          <BaseDashboardFields
                            registrationId={selectedRegistration.id}
                          />
                          <PreservePhone value={primaryContact?.phone ?? null} />
                          <PreserveAttendance
                            availabilityUnknown={availabilityUnknown}
                            selectedSlots={selectedAttendanceSlots}
                          />
                          <PreserveMoments momentChoices={momentChoices} />
                          <input
                            type="hidden"
                            name="updatesAccessibility"
                            value="on"
                          />
                          <fieldset
                            disabled={!editable}
                            className="grid gap-3 disabled:opacity-70"
                          >
                            <input
                              id="hasAccessibilityNeeds"
                              type="checkbox"
                              name="hasAccessibilityNeeds"
                              defaultChecked={hasAccessibilityRequest}
                              className="peer absolute ml-3 mt-4 h-4 w-4"
                            />
                            <label
                              htmlFor="hasAccessibilityNeeds"
                              className="block rounded-md border border-[var(--peace-border)] py-3 pl-10 pr-3 text-sm"
                            >
                              {copy.accessibilityRequest}
                            </label>
                            <div className="hidden gap-3 peer-checked:grid">
                              <div>
                                <h3 className="font-semibold">
                                  {copy.accessibilityTitle}
                                </h3>
                                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--peace-muted)]">
                                  {copy.accessibilityHelp}
                                </p>
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2">
                                {ACCESSIBILITY_DIFFICULTIES.map((difficulty) => (
                                  <label
                                    key={difficulty.key}
                                    className="flex min-h-14 items-start gap-3 rounded-md border border-[var(--peace-border)] p-3 text-sm text-[var(--peace-ink)]"
                                  >
                                    <input
                                      name={`accessibility_${difficulty.key}`}
                                      type="checkbox"
                                      defaultChecked={Boolean(
                                        accessibility?.washington_group_answers?.[
                                          difficulty.key
                                        ]
                                      )}
                                      className="mt-1 h-4 w-4"
                                    />
                                    <span>{difficulty.label[locale] ?? difficulty.label.en}</span>
                                  </label>
                                ))}
                              </div>
                              <Field label={copy.accessibilityNotes}>
                                <textarea
                                  name="accessibilityNotes"
                                  className="field min-h-28"
                                  defaultValue={
                                    accessibility?.operational_notes ?? ""
                                  }
                                />
                              </Field>
                            </div>
                          </fieldset>
                          <SaveInlineButton editable={Boolean(editable)} copy={copy} />
                        </form>
                      </EditableInfo>

                      {!editable ? (
                        <p className="text-sm text-[#6f7f91]">
                          {copy.editClosed}
                        </p>
                      ) : null}
                    </section>
                  </section>
                ) : null}
              </DashboardOverlay>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}

async function getQrStatus(registrationId: string): Promise<{ data: QrStatusRow | null }> {
  try {
    const serviceSupabase = createSupabaseServiceClient();
    const { data } = await serviceSupabase
      .from("qr_tokens")
      .select("status,expires_at,token_encrypted")
      .eq("registration_id", registrationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return { data: (data as QrStatusRow | null) ?? null };
  } catch {
    return { data: null };
  }
}

async function getQrDataUrl(qrStatus: QrStatusRow | null): Promise<string | null> {
  const token = decryptQrToken(qrStatus?.token_encrypted);

  if (!token) {
    return null;
  }

  try {
    return await renderQrDataUrl(token);
  } catch {
    return null;
  }
}

function QrPreview({
  participantCode,
  qrDataUrl,
  copy,
}: {
  participantCode: string;
  qrDataUrl: string | null;
  copy: ParticipantDashboardCopy;
}) {
  const cells = buildQrPreviewCells(participantCode || "PACE");

  return (
    <div className="mx-auto grid w-full max-w-48 gap-3">
      {qrDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={qrDataUrl}
          alt={copy.personalQrAlt}
          className="aspect-square rounded-md border border-[var(--peace-border-strong)] bg-white p-3"
        />
      ) : (
        <div
          className="grid aspect-square grid-cols-9 rounded-md border border-[var(--peace-border-strong)] bg-[var(--peace-soft)] p-3"
          aria-hidden="true"
        >
          {cells.map((active, index) => (
            <span
              key={index}
              className={active ? "bg-[var(--peace-ink)]" : "bg-transparent"}
            />
          ))}
        </div>
      )}
      <p className="text-center text-sm font-semibold text-[var(--peace-ink)]">
        <span className="text-xs uppercase tracking-wide text-[#6f7f91]">
          {copy.yourCode}:
        </span>{" "}
        <span className="font-mono">{participantCode || "QR"}</span>
      </p>
    </div>
  );
}

function EditableInfo({
  label,
  value,
  editable,
  copy,
  children,
}: {
  label: string;
  value: string;
  editable: boolean;
  copy: ParticipantDashboardCopy;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-md border border-[var(--peace-border)] p-4 sm:col-span-2">
      <summary className="grid cursor-pointer list-none gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#6f7f91]">
            {label}
          </p>
          <p className="mt-1 text-sm leading-6">{value}</p>
        </div>
        <span
          className="grid size-8 place-items-center rounded-full border border-[var(--peace-border-strong)] text-lg text-[var(--peace-blue-800)] group-open:bg-[var(--peace-sky-100)]"
          aria-hidden="true"
          title={editable ? copy.edit : copy.editUnavailable}
        >
          &#9998;
        </span>
      </summary>
      <div className="mt-4 border-t border-[var(--peace-border)] pt-4">{children}</div>
    </details>
  );
}

function BaseDashboardFields({ registrationId }: { registrationId: string }) {
  return <input type="hidden" name="registrationId" value={registrationId} />;
}

function PreservePhone({ value }: { value: string | null }) {
  return value ? <input type="hidden" name="phone" value={value} /> : null;
}

function AttendanceSlotTable({
  columns,
  selectedSlots,
  locale,
}: {
  columns: ReturnType<typeof buildAttendanceDayColumns>;
  selectedSlots: Set<string>;
  locale: SupportedLocale;
}) {
  if (columns.length === 0) {
    return null;
  }

  const gridTemplateColumns = `minmax(7rem, 0.7fr) repeat(${columns.length}, minmax(5.5rem, 1fr))`;

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--peace-border)]">
      <div
        className="grid bg-[#f7fbfe] text-center text-xs font-semibold uppercase text-[var(--peace-muted)]"
        style={{ gridTemplateColumns }}
      >
        <div className="border-r border-[var(--peace-border)] px-3 py-3 text-left">
          Fascia
        </div>
        {columns.map((column) => (
          <div
            key={column.day}
            className="border-r border-[var(--peace-border)] px-3 py-3 last:border-r-0"
          >
            {column.label}
          </div>
        ))}
      </div>
      {ATTENDANCE_PARTS.map((part) => (
        <div
          key={part.value}
          className="grid border-t border-[var(--peace-border)]"
          style={{ gridTemplateColumns }}
        >
          <div className="border-r border-[var(--peace-border)] bg-[#fbfdff] px-3 py-3 text-sm font-medium text-[var(--peace-ink)]">
            {part.label[locale] ?? part.label.en}
          </div>
          {columns.map((column) => {
            const slotAvailable = column.parts.includes(part.value);
            const slotValue = encodeAttendanceSlot({
              day: column.day,
              part: part.value as AttendancePart,
            });

            return (
              <label
                key={`${column.day}-${part.value}`}
                className={`flex min-h-14 items-center justify-center border-r border-[var(--peace-border)] px-3 py-2 last:border-r-0 ${
                  slotAvailable
                    ? "bg-white text-[var(--peace-ink)]"
                    : "bg-[#f3f6f9] text-[#9aa8b8]"
                }`}
              >
                {slotAvailable ? (
                  <input
                    type="checkbox"
                    name="availabilitySlots"
                    value={slotValue}
                    defaultChecked={selectedSlots.has(slotValue)}
                    className="h-4 w-4 accent-[var(--peace-blue-800)]"
                    aria-label={`${part.label[locale] ?? part.label.en} ${column.label}`}
                  />
                ) : (
                  <span aria-hidden="true">-</span>
                )}
              </label>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function PreserveAttendance({
  availabilityUnknown,
  selectedSlots,
}: {
  availabilityUnknown: boolean;
  selectedSlots: AttendanceSlot[];
}) {
  return (
    <>
      {availabilityUnknown ? (
        <input type="hidden" name="availabilityUnknown" value="on" />
      ) : null}
      {!availabilityUnknown
        ? selectedSlots.map((slot) => (
            <input
              key={attendanceSlotKey(slot)}
              type="hidden"
              name="availabilitySlots"
              value={encodeAttendanceSlot(slot)}
            />
          ))
        : null}
    </>
  );
}

function PreserveMoments({
  momentChoices,
}: {
  momentChoices: MomentChoiceRow[];
}) {
  return (
    <>
      {momentChoices.map((choice) => (
        <input
          key={choice.moment_id}
          type="hidden"
          name={`moment_${choice.moment_id}`}
          value={choice.choice}
        />
      ))}
    </>
  );
}

function SaveInlineButton({
  editable,
  copy,
}: {
  editable: boolean;
  copy: ParticipantDashboardCopy;
}) {
  return (
    <PendingSubmitButton
      disabled={!editable}
      className="w-fit rounded-md bg-[var(--peace-blue-800)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--peace-blue-900)] disabled:cursor-not-allowed disabled:bg-[#8aa6bd]"
    >
      {copy.save}
    </PendingSubmitButton>
  );
}

function QrStatusIndicator({
  active,
  copy,
}: {
  active: boolean;
  copy: ParticipantDashboardCopy;
}) {
  const label = active ? copy.qrActive : copy.qrInactive;

  return (
    <span
      aria-label={label}
      title={label}
      tabIndex={0}
      className="group absolute right-4 top-4 inline-flex size-4 rounded-full focus:outline-none"
    >
      <span
        aria-hidden="true"
        className={
          active
            ? "size-4 rounded-full bg-[#2f8f4e] ring-4 ring-[#e4f3e7]"
            : "size-4 rounded-full bg-[#c94b3b] ring-4 ring-[#f7dfdc]"
        }
      />
      <span className="pointer-events-none absolute right-0 top-7 z-10 w-max max-w-52 rounded-md bg-[var(--peace-ink)] px-3 py-2 text-xs font-semibold text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-focus:opacity-100">
        {label}
      </span>
    </span>
  );
}

function QrActionButtons({
  participantCode,
  qrDataUrl,
  copy,
}: {
  participantCode: string | null;
  qrDataUrl: string | null;
  copy: ParticipantDashboardCopy;
}) {
  return (
    <div className="grid gap-2">
      {qrDataUrl ? (
        <a
          href={qrDataUrl}
          download={`qr-${participantCode ?? copy.personalQrFile}.png`}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--peace-blue-900)]"
        >
          <DownloadIcon />
          {copy.downloadImage}
        </a>
      ) : (
        <button
          type="button"
          disabled
          className="inline-flex min-h-11 cursor-not-allowed items-center justify-center gap-2 rounded-md bg-[#8aa6bd] px-4 text-sm font-semibold text-white"
        >
          <DownloadIcon />
          {copy.downloadImage}
        </button>
      )}
      <button
        type="button"
        disabled
        title={copy.availableLater}
        className="inline-flex min-h-11 cursor-not-allowed items-center justify-center gap-2 rounded-md border border-[var(--peace-border-strong)] px-4 text-sm font-semibold text-[#6f7f91]"
      >
        <WalletIcon />
        {copy.addToWallet}
      </button>
    </div>
  );
}

function RegistrationSummaryCard({
  copy,
  participant,
  primaryContact,
  questionnaire,
  attendanceSummary,
  supportSummary,
  groupSummary,
  selectedPanels,
  active,
  locale,
}: {
  copy: ParticipantDashboardCopy;
  participant: ParticipantRow;
  primaryContact: ContactRow | null;
  questionnaire: QuestionnaireRow | null;
  attendanceSummary: string;
  supportSummary: string;
  groupSummary: { name: string; leaderName: string | null } | null;
  selectedPanels: MomentRow[];
  active: boolean;
  locale: SupportedLocale;
}) {
  const panelSummary =
    selectedPanels.length > 0
      ? selectedPanels.map((panel) => panel.title).join(", ")
      : copy.notProvided;

  return (
    <details
      open
      data-testid="registration-summary-card"
      className="group w-full rounded-lg border border-[var(--peace-border-strong)] bg-white shadow-sm"
    >
      <summary
        data-testid="registration-summary-toggle"
        className="grid cursor-pointer list-none gap-3 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center"
      >
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-tight text-[var(--peace-ink)] sm:text-xl">
            {copy.registrationSummary}
          </h2>
        </div>
        <span
          className="inline-flex min-h-10 w-fit items-center justify-center gap-2 rounded-md border border-[var(--peace-border-strong)] px-3 text-sm font-semibold text-[var(--peace-blue-800)] transition group-open:bg-[var(--peace-sky-100)]"
          aria-hidden="true"
        >
          <span className="group-open:hidden">{copy.expand}</span>
          <span className="hidden group-open:inline">{copy.collapse}</span>
          <ChevronIcon />
        </span>
      </summary>
      <div className="border-t border-[var(--peace-border)] px-4 pb-4 pt-3">
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
          <SummaryInfo
            label="Email"
            value={primaryContact?.email ?? copy.notProvided}
            className="col-span-2 xl:col-span-1"
          />
          <SummaryInfo
            label={copy.phone}
            value={primaryContact?.phone ?? copy.notProvided}
          />
          <SummaryInfo
            label={copy.birthDate}
            value={formatDate(participant.birth_date, locale, copy)}
          />
          <SummaryInfo
            label={copy.birthPlace}
            value={questionnaire?.answers?.birthPlace ?? copy.notProvided}
          />
          <SummaryInfo
            label={copy.nationality}
            value={questionnaire?.answers?.nationality ?? copy.notProvided}
          />
          <SummaryInfo label={copy.expectedPresence} value={attendanceSummary} />
          <SummaryInfo label={copy.accessibilitySupport} value={supportSummary} />
          <SummaryInfo
            label={copy.group}
            value={groupSummary?.name ?? copy.notAssigned}
          />
          <SummaryInfo
            label={copy.leader}
            value={groupSummary?.leaderName ?? copy.notAssigned}
          />
          <SummaryInfo label={copy.panelsTitle} value={panelSummary} />
        </div>
        <div className="mt-3 flex justify-start">
          <Link
            href="/dashboard/partecipante?overlay=iscrizione"
            className={
              active
                ? "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white"
                : "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[var(--peace-border-strong)] px-4 text-sm font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]"
            }
          >
            <ActionIcon icon="form" active={active} />
            {copy.edit}
          </Link>
        </div>
      </div>
    </details>
  );
}

function SummaryInfo({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={`min-w-0 rounded-md border border-[var(--peace-border)] bg-[var(--peace-soft)] px-3 py-1.5 ${className}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-[#6f7f91]">
        {label}
      </p>
      <p className="mt-0.5 break-words text-sm leading-5 text-[var(--peace-ink)]">
        {value}
      </p>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M12 3v11" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a3 3 0 0 1 3-3h12" />
      <path d="M16 13h6v4h-6a2 2 0 0 1 0-4Z" />
      <path d="M6 5h11a2 2 0 0 1 2 2" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4 shrink-0 transition group-open:rotate-180"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ActionIcon({
  icon,
  active,
}: {
  icon: "qr" | "form";
  active: boolean;
}) {
  if (icon === "qr") {
    const activeCells = new Set([0, 1, 3, 4, 5, 6, 8, 9, 12, 15, 16, 18, 20, 21, 22, 24]);

    return (
      <span
        aria-hidden="true"
        className="grid size-6 shrink-0 grid-cols-5 gap-0.5 rounded-sm"
      >
        {Array.from({ length: 25 }, (_, cell) => (
          <span
            key={cell}
            className={
              activeCells.has(cell)
                ? active
                  ? "rounded-[1px] bg-white"
                  : "rounded-[1px] bg-[var(--peace-blue-800)]"
                : "rounded-[1px] bg-transparent"
            }
          />
        ))}
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={
        active
          ? "grid size-6 shrink-0 gap-1 rounded-sm border border-white p-1"
          : "grid size-6 shrink-0 gap-1 rounded-sm border border-[var(--peace-blue-800)] p-1"
      }
    >
      <span className={active ? "h-0.5 w-3 bg-white" : "h-0.5 w-3 bg-[var(--peace-blue-800)]"} />
      <span className={active ? "h-0.5 w-4 bg-white" : "h-0.5 w-4 bg-[var(--peace-blue-800)]"} />
      <span
        className={active ? "h-0.5 w-3.5 bg-white" : "h-0.5 w-3.5 bg-[var(--peace-blue-800)]"}
      />
    </span>
  );
}

function DashboardOverlay({
  closeHref,
  copy,
  children,
}: {
  closeHref: string;
  copy: ParticipantDashboardCopy;
  children: React.ReactNode;
}) {
  return (
    <div className="dashboard-modal fixed inset-0 z-50 grid place-items-center modal-backdrop px-4 py-5 backdrop-blur-sm sm:px-6">
      <section
        role="dialog"
        aria-modal="true"
        className="relative mx-auto grid max-h-[calc(100vh-2.5rem)] w-full max-w-4xl gap-5 overflow-y-auto rounded-lg border border-[var(--peace-border)] bg-white p-5 shadow-2xl sm:p-6"
      >
        <Link
          href={closeHref}
          aria-label={copy.close}
          title={copy.close}
          className="absolute right-3 top-3 grid size-9 place-items-center rounded-full border border-[var(--peace-border-strong)] text-xl font-semibold text-[var(--peace-ink)] hover:bg-[var(--peace-sky-100)]"
        >
          ×
        </Link>
        <div className="pr-9">{children}</div>
      </section>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3 rounded-lg border border-[var(--peace-border)] bg-white p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-[var(--peace-ink)]">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-[#6f7f91]">
        {label}
      </p>
      <p className="mt-1 text-sm leading-6">{value}</p>
    </div>
  );
}

function relatedOne<T>(value: Related<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  );
}

function formatAttendanceSlotSummary(
  columns: ReturnType<typeof buildAttendanceDayColumns>,
  selectedSlots: Set<string>,
  locale: SupportedLocale
): string {
  return columns
    .map((column) => {
      const selectedParts = ATTENDANCE_PARTS.filter(
        (part) =>
          column.parts.includes(part.value) &&
          selectedSlots.has(
            encodeAttendanceSlot({
              day: column.day,
              part: part.value as AttendancePart,
            })
          )
      );

      if (selectedParts.length === 0) {
        return null;
      }

      return `${column.label}: ${selectedParts
        .map((part) => part.label[locale] ?? part.label.en)
        .join(" e ")}`;
    })
    .filter(Boolean)
    .join(", ");
}

function formatDate(
  value: string | null | undefined,
  locale: SupportedLocale,
  copy: ParticipantDashboardCopy
): string {
  if (!value) {
    return copy.notProvided;
  }

  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? parseDateOnly(value)
    : new Date(value);

  return date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(date)
    : copy.notProvided;
}

function formatDateRange(
  startsOn: string | null | undefined,
  endsOn: string | null | undefined,
  locale: SupportedLocale,
  copy: ParticipantDashboardCopy
): string {
  if (!startsOn && !endsOn) {
    return copy.datesToConfirm;
  }

  if (!endsOn || startsOn === endsOn) {
    return formatDate(startsOn, locale, copy);
  }

  if (!startsOn) {
    return formatDate(endsOn, locale, copy);
  }

  return copy.fromTo(
    formatDate(startsOn, locale, copy),
    formatDate(endsOn, locale, copy)
  );
}

function formatDateTime(
  value: string | null | undefined,
  locale: SupportedLocale,
  copy: ParticipantDashboardCopy
): string {
  if (!value) {
    return copy.notProvided;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? copy.notProvided
    : new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
}

function qrStatusLabel(
  qrStatus: QrStatusRow,
  locale: SupportedLocale,
  copy: ParticipantDashboardCopy
): string {
  if (qrStatus.status === "active") {
    return qrStatus.expires_at
      ? copy.activeUntil(formatDate(qrStatus.expires_at, locale, copy))
      : copy.active;
  }

  if (qrStatus.status === "revoked") {
    return copy.revoked;
  }

  if (qrStatus.status === "expired") {
    return copy.expired;
  }

  return qrStatus.status;
}

function getGroupSummary(
  groupAssignments: GroupAssignmentRow[]
): { name: string; leaderName: string | null } | null {
  const assignment = groupAssignments[0];
  const group = assignment ? relatedOne(assignment.groups) : null;

  if (!assignment || !group) {
    return null;
  }

  return {
    name: group.name,
    leaderName: group.primary_leader_name,
  };
}

function dashboardErrorMessage(
  value: string | undefined,
  copy: ParticipantDashboardCopy
): string {
  return value ? copy.errors[value] ?? value : copy.fallbackError;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseDashboardOverlay(value: string | undefined): DashboardOverlay {
  return value === "qr" || value === "iscrizione" ? value : null;
}

function buildQrPreviewCells(seed: string): boolean[] {
  const cells: boolean[] = [];
  let hash = 0;

  for (const character of seed) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  for (let row = 0; row < 9; row += 1) {
    for (let column = 0; column < 9; column += 1) {
      const inTopLeft = row < 3 && column < 3;
      const inTopRight = row < 3 && column > 5;
      const inBottomLeft = row > 5 && column < 3;
      const finder = inTopLeft || inTopRight || inBottomLeft;
      const finderCenter =
        (row === 1 && column === 1) ||
        (row === 1 && column === 7) ||
        (row === 7 && column === 1);
      const patterned = ((hash + row * 17 + column * 29) % 5) < 2;

      cells.push(finder ? finderCenter || row % 2 === 0 || column % 2 === 0 : patterned);
    }
  }

  return cells;
}
