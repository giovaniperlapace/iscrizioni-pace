"use client";

import { publicChildBirthDateBounds } from "@/lib/registrations/public-child-age";

import { RequiredIndicator, RequiredFieldsNote } from "@/components/required-indicator";
import { OTHER_PHONE_PREFIX, PHONE_PREFIX_OPTIONS } from "@/lib/registrations/phone-prefixes";

import { ACCESSIBILITY_COMMUNICATION_HELP } from "@/lib/i18n/accessibility";
import { migratePublicRegistrationDrafts } from "@/lib/forms/public-draft";

import { useCallback, useEffect, useRef, useState } from "react";

import { submitPublicRegistration } from "@/app/actions";
import { EventIdentity } from "@/components/event-identity";
import {
  findMatchingGroupCandidates,
  formatGroupOptionLabel,
  normalizeMatchText,
} from "@/lib/groups/matching";
import {
  ACCESSIBILITY_DIFFICULTIES,
  EUROPEAN_CITY_OPTIONS,
  EUROPEAN_COUNTRIES,
  NATIONALITY_OPTIONS,
  PLACEHOLDER_GROUPS,
} from "@/lib/questionnaire/registration";
import type { PublicRegistrationOptions } from "@/lib/registrations/public-flow";
import type { SupportedLocale } from "@/lib/i18n/config";
import { countryName, findCountryId } from "@/lib/registrations/country-names";
import { isCountryName, COUNTRY_VALIDATION_MESSAGE } from "@/lib/registrations/country-validation";
import {
  ATTENDANCE_PARTS,
  buildAttendanceDayColumns,
  encodeAttendanceSlot,
  type AttendancePart,
} from "@/lib/registrations/attendance-slots";

type RegistrationFormProps = {
  email: string;
  error?: string;
  groupRegistrationLinkToken: string | null;
  identitySuggestion: { firstName: string; lastName: string } | null;
  locale: SupportedLocale;
  options: PublicRegistrationOptions;
};

const OTHER_COUNTRY = "Altro / non in lista";
const OTHER_CITY = "Altro / non in lista";
const FORM_STORAGE_PREFIX = "iscrizioni-pace.registration-form-v2";

type PromptField =
  | "hasAccessibilityNeeds"
  | "hasPreviousSantegidioParticipation"
  | "participatesWithGroup"
  | "availabilityDays";

type StoredRegistrationForm = {
  email: string;
  savedAt: number;
  fields: Record<string, string[]>;
  state: {
    hasAccessibilityNeeds: string;
    hasPreviousParticipation: string;
    participatesWithGroup: string;
    birthDate: string;
    countrySearch: string;
    selectedCountry: string;
    customCountry: string;
    citySearch: string;
    selectedCity: string;
    customCity: string;
    nationalitySearch: string;
    selectedNationality: string;
    groupSearch: string;
    cannotFindLeader: boolean;
    selectedGroupValue: string;
    phonePrefix: string;
    customPhonePrefix: string;
    phoneNumber: string;
    participatesWithChildren: string;
    childrenCount: number;
    selectedAttendanceSlots: string[];
    selectedEventDays?: string[];
    availabilityUnknown: boolean;
  };
};

type RegistrationFormCopy = {
  emailConfirmation: string;
  emailMismatch: string;
  childrenHelp: string;
  newRegistration: string;
  intro: string;
  groupLinkPrefix: string;
  groupLinkSuffix: string;
  firstName: string;
  lastName: string;
  country: string;
  countryPlaceholder: string;
  countryOtherPlaceholder: string;
  noCountry: string;
  city: string;
  cityPlaceholder: string;
  cityDisabledPlaceholder: string;
  cityOtherPlaceholder: string;
  noCity: string;
  birthDate: string;
  birthPlace: string;
  birthPlacePlaceholder: string;
  nationality: string;
  nationalityPlaceholder: string;
  noNationality: string;
  phone: string;
  phonePrefixLabel: string;
  phoneOther: string;
  phoneNumberPlaceholder: string;
  phonePrefixPlaceholder: string;
  phoneTitle: string;
  childrenQuestion: string;
  childrenCount: string;
  childCard: (index: number) => string;
  childFirstName: string;
  childLastName: string;
  childBirthDate: string;
  accessibilityQuestion: string;
  accessibilityTitle: string;
  previousQuestion: string;
  externalGroupQuestion: string;
  externalGroupPlaceholder: string;
  groupQuestion: string;
  groupLabel: string;
  groupPlaceholder: string;
  groupDisabledPlaceholder: string;
  noMatchingLeader: string;
  cannotFindLeader: string;
  daysTitle: string;
  daysHelp: string;
  daysUnknown: string;
  privacyTitle: string;
  privacyBody: string;
  privacyConsent: string;
  sensitiveConsent: string;
  futureEventsConsent: string;
  requiredChoice: string;
  requiredGroup: string;
  requiredDays: string;
  yes: string;
  no: string;
  submit: string;
  submitting: string;
};

const REGISTRATION_FORM_COPY: Record<SupportedLocale, RegistrationFormCopy> = {
  it: {
    emailConfirmation: "Conferma email",
    emailMismatch: "Gli indirizzi email devono coincidere.",
    childrenHelp: "Questa funzione è pensata per iscrivere i bambini accompagnati, da 0 a 17 anni compiuti alla data di iscrizione. I figli iscritti qui resteranno sempre collegati alla tua iscrizione per i panel e gli altri eventi. Se entrambi i genitori si iscrivono alla preghiera, inserite i figli nell’iscrizione di un solo genitore.",
    newRegistration: "Nuova iscrizione",
    intro:
      "Compila questo modulo per iscriverti all'evento. Dopo l'invio potrai accedere alla tua area personale e scaricare il QR code per l'ingresso. Quando sarà pubblicato il programma completo, potrai anche scegliere a quali incontri tematici e altri eventi partecipare.",
    groupLinkPrefix: "Usa questo link per iscriverti con il gruppo",
    groupLinkSuffix: ".",
    firstName: "Nome",
    lastName: "Cognome",
    country: "Paese in cui vivi abitualmente",
    countryPlaceholder: "Cerca il paese in cui vivi",
    countryOtherPlaceholder: "Scrivi il paese in cui vivi",
    noCountry: "Nessun paese trovato",
    city: "Città in cui vivi abitualmente",
    cityPlaceholder: "Cerca la città in cui vivi",
    cityDisabledPlaceholder: "Seleziona prima il paese",
    cityOtherPlaceholder: "Scrivi la città in cui vivi",
    noCity: "Nessuna città trovata",
    birthDate: "Data di nascita",
    birthPlace: "Luogo di nascita (paese e città)",
    birthPlacePlaceholder: "Per esempio: Italia, Roma",
    nationality: "Nazionalità",
    nationalityPlaceholder: "Cerca la nazionalità",
    noNationality: "Nessuna nazionalità trovata",
    phone: "Telefono (opzionale)",
    phonePrefixLabel: "Prefisso internazionale",
    phoneOther: "Altro",
    phoneNumberPlaceholder: "Numero",
    phonePrefixPlaceholder: "Scrivi il prefisso, per esempio +234",
    phoneTitle: "Inserisci solo cifre, spazi, punti, parentesi o trattini.",
    childrenQuestion: "Parteciperai all'evento con uno o più figli?",
    childrenCount: "Con quanti figli parteciperai?",
    childCard: (index) => `Figlio ${index}`,
    childFirstName: "Nome",
    childLastName: "Cognome",
    childBirthDate: "Data di nascita",
    accessibilityQuestion:
      "Hai una disabilità, una condizione di salute o un bisogno di accessibilità che desideri segnalarci per organizzare meglio l'accoglienza?",
    accessibilityTitle: "Quali aspetti dobbiamo considerare?",
    previousQuestion: "Hai partecipato ad altri eventi della Comunità di Sant’Egidio?",
    externalGroupQuestion: "Fai parte di qualche associazione?",
    externalGroupPlaceholder: "Nome dell’associazione (facoltativo)",
    groupQuestion: "Parteciperai alla Preghiera per la Pace con un gruppo della Comunità?",
    groupLabel: "Gruppo",
    groupPlaceholder: "Cerca il tuo gruppo",
    groupDisabledPlaceholder: "Indica prima paese, città e data di nascita",
    noMatchingLeader: "Nessun gruppo corrispondente trovato",
    cannotFindLeader: "Non trovo il mio gruppo",
    daysTitle: "In quali giorni pensi di essere presente?",
    daysHelp:
      "Seleziona le mattine e i pomeriggi in cui pensi di essere presente, oppure indica che lo comunicherai più avanti.",
    daysUnknown: "Non lo so ancora, lo comunicherò in seguito",
    privacyTitle: "Privacy e trattamento dati",
    privacyBody:
      "Confermo di aver letto l'informativa privacy dell'evento e autorizzo il trattamento dei dati inseriti per gestire l'iscrizione, l'identificazione del partecipante, le comunicazioni organizzative, l'accoglienza, gli eventuali bisogni di accessibilità e gli adempimenti di sicurezza e legge collegati all'evento. I dati saranno trattati secondo il Regolamento UE 2016/679 (GDPR), con misure adeguate di riservatezza, accesso limitato ai soli incaricati e conservazione per il tempo necessario alle finalità indicate. So che posso esercitare i diritti di accesso, rettifica, cancellazione, limitazione, opposizione e revoca del consenso, senza pregiudicare la liceità del trattamento già effettuato.",
    privacyConsent:
      "Accetto l'informativa privacy e autorizzo il trattamento dei dati necessari alla gestione dell'iscrizione e dell'evento. Se iscrivo uno o più figli, confermo di esercitare la responsabilità genitoriale o di essere autorizzato a comunicarne i dati.",
    sensitiveConsent:
      "Acconsento al trattamento delle informazioni su disabilità, salute o bisogni di accessibilità indicate, per predisporre misure di accoglienza e supporto durante l'evento.",
    futureEventsConsent:
      "Acconsento a ricevere comunicazioni informative su futuri eventi e iniziative della Comunità di Sant'Egidio. Il consenso è facoltativo e può essere revocato in qualsiasi momento.",
    requiredChoice: "Seleziona una risposta per proseguire.",
    requiredGroup: "Seleziona un gruppo o indica che non lo trovi.",
    requiredDays: "Seleziona almeno una mattina o un pomeriggio, oppure indica che lo comunicherai in seguito.",
    yes: "Sì",
    no: "No",
    submit: "Invia iscrizione",
    submitting: "Invio iscrizione...",
  },
  en: {
    emailConfirmation: "Confirm email",
    emailMismatch: "The email addresses must match.",
    childrenHelp: "This feature is intended for registering accompanied children aged 0 to 17 on the registration date. Children registered here will always remain linked to your registration for panels and other events. If both parents register for the prayer, include the children in only one parent’s registration.",
    newRegistration: "New registration",
    intro:
      "Complete this form to register for the event. Once you have submitted your registration, you will be able to access your dashboard and download your entry QR code. When the full programme is published, you will also be able to choose which panel discussions and other events to attend.",
    groupLinkPrefix: "Use this link to register as part of the group",
    groupLinkSuffix: ".",
    firstName: "First name",
    lastName: "Last name",
    country: "Country of residence",
    countryPlaceholder: "Search for the country where you live",
    countryOtherPlaceholder: "Enter the country where you live",
    noCountry: "No country found",
    city: "City of residence",
    cityPlaceholder: "Search for the city where you live",
    cityDisabledPlaceholder: "Select the country first",
    cityOtherPlaceholder: "Enter the city where you live",
    noCity: "No city found",
    birthDate: "Date of birth",
    birthPlace: "Place of birth (country and city)",
    birthPlacePlaceholder: "For example: Italy, Rome",
    nationality: "Nationality",
    nationalityPlaceholder: "Search for your nationality",
    noNationality: "No nationality found",
    phone: "Phone number (optional)",
    phonePrefixLabel: "Country calling code",
    phoneOther: "Other",
    phoneNumberPlaceholder: "Phone number",
    phonePrefixPlaceholder: "Enter the country calling code, e.g. +234",
    phoneTitle: "Use only digits, spaces, full stops, parentheses or hyphens.",
    childrenQuestion: "Will any of your children be attending the event with you?",
    childrenCount: "How many of your children will be attending with you?",
    childCard: (index) => `Child ${index}`,
    childFirstName: "First name",
    childLastName: "Last name",
    childBirthDate: "Date of birth",
    accessibilityQuestion:
      "Do you have a disability, health condition or accessibility need that you would like us to know about so we can better support you at the event?",
    accessibilityTitle: "What should we take into account?",
    previousQuestion: "Have you attended other events organised by the Community of Sant’Egidio?",
    externalGroupQuestion: "Are you a member of an association?",
    externalGroupPlaceholder: "Association name (optional)",
    groupQuestion: "Will you attend the Prayer for Peace with a group from the Community?",
    groupLabel: "Group",
    groupPlaceholder: "Search for your group",
    groupDisabledPlaceholder: "Enter your country, city and date of birth first",
    noMatchingLeader: "No matching group found",
    cannotFindLeader: "I cannot find my group",
    daysTitle: "Which days do you plan to attend?",
    daysHelp:
      "Select the mornings and afternoons you plan to attend, or let us know later if you are not yet sure.",
    daysUnknown: "I am not sure yet; I will let you know later",
    privacyTitle: "Privacy and data processing",
    privacyBody:
      "I confirm that I have read the event privacy notice and authorise the processing of the data entered to manage the registration, identify the participant, send organisational communications, make arrangements to welcome participants, address any accessibility needs and fulfil safety and legal requirements connected with the event. The data will be processed under EU Regulation 2016/679 (GDPR), with appropriate confidentiality measures, access limited to authorised staff and storage only for the time needed for the stated purposes. I know that I may exercise the rights of access, rectification, erasure, restriction, objection and withdrawal of consent, without affecting the lawfulness of processing already carried out.",
    privacyConsent:
      "I accept the privacy notice and authorise the processing of the data needed to manage the registration and the event. If I register one or more children, I confirm that I have parental responsibility or am authorised to provide their data.",
    sensitiveConsent:
      "I consent to the processing of the information provided about disability, health or accessibility needs, so that appropriate arrangements can be made to welcome and support me during the event.",
    futureEventsConsent:
      "I agree to receive information about future events and initiatives of the Community of Sant'Egidio. This consent is optional and may be withdrawn at any time.",
    requiredChoice: "Select an answer to continue.",
    requiredGroup: "Select a group or indicate that you cannot find it.",
    requiredDays: "Select at least one morning or afternoon, or indicate that you will let us know later.",
    yes: "Yes",
    no: "No",
    submit: "Submit registration",
    submitting: "Submitting registration...",
  },
  fr: {
    emailConfirmation: "Confirmer l’adresse e-mail",
    emailMismatch: "Les adresses e-mail doivent être identiques.",
    childrenHelp: "Cette fonction est destinée à inscrire les enfants accompagnés, âgés de 0 à 17 ans à la date d’inscription. Les enfants inscrits ici resteront toujours liés à ton inscription pour les panels et les autres événements. Si les deux parents s’inscrivent à la prière, inscrivez les enfants avec un seul parent.",
    newRegistration: "Nouvelle inscription",
    intro:
      "Remplis ce formulaire pour t'inscrire à l'événement. Une fois ton inscription envoyée, tu pourras accéder à ton espace personnel et télécharger ton QR code d'entrée. Lorsque le programme complet sera publié, tu pourras aussi choisir les tables rondes thématiques et les autres événements auxquels tu souhaites participer.",
    groupLinkPrefix: "Utilise ce lien pour t'inscrire avec le groupe",
    groupLinkSuffix: ".",
    firstName: "Prénom",
    lastName: "Nom",
    country: "Pays où tu vis habituellement",
    countryPlaceholder: "Cherche le pays où tu vis",
    countryOtherPlaceholder: "Saisis le pays où tu vis",
    noCountry: "Aucun pays trouvé",
    city: "Ville où tu vis habituellement",
    cityPlaceholder: "Cherche la ville où tu vis",
    cityDisabledPlaceholder: "Sélectionne d'abord le pays",
    cityOtherPlaceholder: "Saisis la ville où tu vis",
    noCity: "Aucune ville trouvée",
    birthDate: "Date de naissance",
    birthPlace: "Lieu de naissance (pays et ville)",
    birthPlacePlaceholder: "Par exemple : Italie, Rome",
    nationality: "Nationalité",
    nationalityPlaceholder: "Recherche ta nationalité",
    noNationality: "Aucune nationalité trouvée",
    phone: "Téléphone (facultatif)",
    phonePrefixLabel: "Indicatif téléphonique international",
    phoneOther: "Autre",
    phoneNumberPlaceholder: "Numéro",
    phonePrefixPlaceholder: "Saisis l'indicatif, par exemple +234",
    phoneTitle: "Saisis uniquement des chiffres, espaces, points, parenthèses ou tirets.",
    childrenQuestion: "Un ou plusieurs de tes enfants participeront-ils à l'événement avec toi ?",
    childrenCount: "Combien de tes enfants participeront avec toi ?",
    childCard: (index) => `Enfant ${index}`,
    childFirstName: "Prénom",
    childLastName: "Nom",
    childBirthDate: "Date de naissance",
    accessibilityQuestion:
      "As-tu un handicap, un problème de santé ou un besoin d'accessibilité que tu souhaites nous signaler pour mieux organiser l'accueil ?",
    accessibilityTitle: "Quels aspects devons-nous prendre en compte ?",
    previousQuestion: "As-tu participé à d’autres événements de la Communauté de Sant’Egidio ?",
    externalGroupQuestion: "Fais-tu partie d’une association ?",
    externalGroupPlaceholder: "Nom de l’association (facultatif)",
    groupQuestion: "Participeras-tu à la Prière pour la Paix avec un groupe de la Communauté ?",
    groupLabel: "Groupe",
    groupPlaceholder: "Recherche ton groupe",
    groupDisabledPlaceholder: "Indique d'abord ton pays, ta ville et ta date de naissance",
    noMatchingLeader: "Aucun groupe correspondant trouvé",
    cannotFindLeader: "Je ne trouve pas mon groupe",
    daysTitle: "Quels jours prévois-tu de participer ?",
    daysHelp:
      "Sélectionne les matinées et les après-midi où tu prévois de participer, ou indique que tu nous le préciseras plus tard.",
    daysUnknown: "Je ne sais pas encore ; je vous le préciserai plus tard",
    privacyTitle: "Confidentialité et traitement des données",
    privacyBody:
      "Je confirme avoir lu la notice de confidentialité de l'événement et j'autorise le traitement des données saisies pour gérer l'inscription, identifier le participant, envoyer les communications d'organisation, organiser l'accueil, gérer les éventuels besoins d'accessibilité et remplir les obligations de sécurité et légales liées à l'événement. Les données seront traitées conformément au Règlement UE 2016/679 (RGPD), avec des mesures appropriées de confidentialité, un accès limité aux personnes autorisées et une conservation limitée au temps nécessaire aux finalités indiquées. Je sais que je peux exercer mes droits d'accès, rectification, effacement, limitation, opposition et retrait du consentement, sans affecter la licéité du traitement déjà effectué.",
    privacyConsent:
      "J'accepte la notice de confidentialité et j'autorise le traitement des données nécessaires à la gestion de l'inscription et de l'événement. Si j'inscris un ou plusieurs enfants, je confirme exercer l'autorité parentale ou être autorisé à communiquer leurs données.",
    sensitiveConsent:
      "Je consens au traitement des informations fournies concernant un handicap, la santé ou des besoins d'accessibilité, afin de prévoir un accueil et un accompagnement adaptés pendant l'événement.",
    futureEventsConsent:
      "J'accepte de recevoir des communications d'information sur les futurs événements et initiatives de la Communauté de Sant'Egidio. Ce consentement est facultatif et peut être retiré à tout moment.",
    requiredChoice: "Sélectionne une réponse pour continuer.",
    requiredGroup: "Sélectionne un groupe ou indique que tu ne le trouves pas.",
    requiredDays: "Sélectionne au moins une matinée ou un après-midi, ou indique que tu nous le préciseras plus tard.",
    yes: "Oui",
    no: "Non",
    submit: "Envoyer l'inscription",
    submitting: "Envoi de l'inscription...",
  },
  de: {
    emailConfirmation: "E-Mail bestätigen",
    emailMismatch: "Die E-Mail-Adressen müssen übereinstimmen.",
    childrenHelp: "Diese Funktion ist für die Anmeldung begleiteter Kinder gedacht, die am Tag der Anmeldung 0 bis 17 Jahre alt sind. Hier angemeldete Kinder bleiben für Podiumsgespräche und andere Veranstaltungen immer mit deiner Anmeldung verbunden. Wenn sich beide Eltern zum Gebet anmelden, tragt die Kinder nur bei einem Elternteil ein.",
    newRegistration: "Neue Anmeldung",
    intro:
      "Fülle dieses Formular aus, um dich für die Veranstaltung anzumelden. Nach dem Absenden kannst du deinen persönlichen Bereich öffnen und deinen QR-Code für den Einlass herunterladen. Sobald das vollständige Programm veröffentlicht ist, kannst du auch auswählen, an welchen Podiumsdiskussionen und weiteren Veranstaltungen du teilnehmen möchtest.",
    groupLinkPrefix: "Über diesen Link meldest du dich zusammen mit der folgenden Gruppe an:",
    groupLinkSuffix: ".",
    firstName: "Vorname",
    lastName: "Nachname",
    country: "Land, in dem du lebst",
    countryPlaceholder: "Suche das Land, in dem du lebst",
    countryOtherPlaceholder: "Gib das Land ein, in dem du lebst",
    noCountry: "Kein Land gefunden",
    city: "Stadt, in der du lebst",
    cityPlaceholder: "Suche die Stadt, in der du lebst",
    cityDisabledPlaceholder: "Wähle zuerst das Land aus",
    cityOtherPlaceholder: "Gib die Stadt ein, in der du lebst",
    noCity: "Keine Stadt gefunden",
    birthDate: "Geburtsdatum",
    birthPlace: "Geburtsort (Land und Stadt)",
    birthPlacePlaceholder: "Zum Beispiel: Italien, Rom",
    nationality: "Staatsangehörigkeit",
    nationalityPlaceholder: "Staatsangehörigkeit suchen",
    noNationality: "Keine Staatsangehörigkeit gefunden",
    phone: "Telefonnummer (optional)",
    phonePrefixLabel: "Internationale Vorwahl",
    phoneOther: "Andere",
    phoneNumberPlaceholder: "Nummer",
    phonePrefixPlaceholder: "Gib die Vorwahl ein, zum Beispiel +234",
    phoneTitle: "Gib nur Ziffern, Leerzeichen, Punkte, Klammern oder Bindestriche ein.",
    childrenQuestion: "Nehmen eines oder mehrere deiner Kinder mit dir an der Veranstaltung teil?",
    childrenCount: "Wie viele deiner Kinder nehmen mit dir teil?",
    childCard: (index) => `Kind ${index}`,
    childFirstName: "Vorname",
    childLastName: "Nachname",
    childBirthDate: "Geburtsdatum",
    accessibilityQuestion:
      "Hast du eine Behinderung, eine gesundheitliche Beeinträchtigung oder besondere Anforderungen an die Barrierefreiheit, über die du uns informieren möchtest, damit wir dich bei der Veranstaltung besser unterstützen können?",
    accessibilityTitle: "Welche Aspekte sollen wir berücksichtigen?",
    previousQuestion: "Hast du an anderen Veranstaltungen der Gemeinschaft Sant’Egidio teilgenommen?",
    externalGroupQuestion: "Gehörst du einem Verein an?",
    externalGroupPlaceholder: "Name des Vereins (optional)",
    groupQuestion: "Wirst du mit einer Gruppe der Gemeinschaft am Gebet für den Frieden teilnehmen?",
    groupLabel: "Gruppe",
    groupPlaceholder: "Suche nach deiner Gruppe",
    groupDisabledPlaceholder: "Gib zuerst Land, Stadt und Geburtsdatum an",
    noMatchingLeader: "Keine passende Gruppe gefunden",
    cannotFindLeader: "Ich finde meine Gruppe nicht",
    daysTitle: "An welchen Tagen wirst du voraussichtlich anwesend sein?",
    daysHelp:
      "Wähle die Vormittage und Nachmittage aus, an denen du teilnehmen möchtest, oder gib an, dass du uns später Bescheid gibst.",
    daysUnknown: "Ich weiß es noch nicht und gebe später Bescheid",
    privacyTitle: "Datenschutz und Datenverarbeitung",
    privacyBody:
      "Ich bestätige, dass ich die Datenschutzhinweise zur Veranstaltung gelesen habe, und erlaube die Verarbeitung der eingegebenen Daten zur Verwaltung der Anmeldung, Identifizierung der teilnehmenden Person, organisatorischen Kommunikation, Organisation des Empfangs, Berücksichtigung eventueller Anforderungen an die Barrierefreiheit sowie zur Erfüllung von Sicherheits- und Rechtspflichten im Zusammenhang mit der Veranstaltung. Die Daten werden gemäß EU-Verordnung 2016/679 (DSGVO) verarbeitet, mit angemessenen Vertraulichkeitsmaßnahmen, Zugriff nur für autorisierte Personen und Speicherung nur für die für die genannten Zwecke erforderliche Zeit. Ich weiß, dass ich meine Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch und Widerruf der Einwilligung ausüben kann, ohne die Rechtmäßigkeit der bereits erfolgten Verarbeitung zu berühren.",
    privacyConsent:
      "Ich akzeptiere die Datenschutzhinweise und erlaube die Verarbeitung der Daten, die für die Verwaltung der Anmeldung und der Veranstaltung erforderlich sind. Wenn ich ein oder mehrere Kinder anmelde, bestätige ich, sorgeberechtigt oder zur Angabe ihrer Daten befugt zu sein.",
    sensitiveConsent:
      "Ich stimme der Verarbeitung der angegebenen Informationen zu Behinderung, Gesundheit oder Anforderungen an die Barrierefreiheit zu, damit geeignete Vorkehrungen für den Empfang und die Unterstützung während der Veranstaltung getroffen werden können.",
    futureEventsConsent:
      "Ich willige ein, Informationen über zukünftige Veranstaltungen und Initiativen der Gemeinschaft Sant'Egidio zu erhalten. Diese Einwilligung ist freiwillig und kann jederzeit widerrufen werden.",
    requiredChoice: "Wähle eine Antwort aus, um fortzufahren.",
    requiredGroup: "Wähle eine Gruppe aus oder gib an, dass du sie nicht findest.",
    requiredDays: "Wähle mindestens einen Vormittag oder Nachmittag aus oder gib an, dass du uns später Bescheid gibst.",
    yes: "Ja",
    no: "Nein",
    submit: "Anmeldung senden",
    submitting: "Anmeldung wird gesendet...",
  },
  es: {
    emailConfirmation: "Confirmar correo electrónico",
    emailMismatch: "Las direcciones de correo electrónico deben coincidir.",
    childrenHelp: "Esta función está pensada para inscribir a niños acompañados de entre 0 y 17 años cumplidos en la fecha de inscripción. Los hijos inscritos aquí permanecerán siempre vinculados a tu inscripción para los paneles y otros eventos. Si ambos progenitores se inscriben en la oración, incluid a los hijos en la inscripción de uno solo.",
    newRegistration: "Nueva inscripción",
    intro:
      "Completa este formulario para inscribirte en el evento. Una vez enviada la inscripción, podrás acceder a tu área personal y descargar tu código QR de entrada. Cuando se publique el programa completo, también podrás elegir las mesas redondas temáticas y los demás eventos en los que quieras participar.",
    groupLinkPrefix: "Utiliza este enlace para inscribirte con el grupo",
    groupLinkSuffix: ".",
    firstName: "Nombre",
    lastName: "Apellidos",
    country: "País en el que vives habitualmente",
    countryPlaceholder: "Busca el país en el que vives",
    countryOtherPlaceholder: "Escribe el país en el que vives",
    noCountry: "No se encontró ningún país",
    city: "Ciudad en la que vives habitualmente",
    cityPlaceholder: "Busca la ciudad en la que vives",
    cityDisabledPlaceholder: "Selecciona primero el país",
    cityOtherPlaceholder: "Escribe la ciudad en la que vives",
    noCity: "No se encontró ninguna ciudad",
    birthDate: "Fecha de nacimiento",
    birthPlace: "Lugar de nacimiento (país y ciudad)",
    birthPlacePlaceholder: "Por ejemplo: Italia, Roma",
    nationality: "Nacionalidad",
    nationalityPlaceholder: "Busca tu nacionalidad",
    noNationality: "No se encontró ninguna nacionalidad",
    phone: "Teléfono (opcional)",
    phonePrefixLabel: "Prefijo internacional",
    phoneOther: "Otro",
    phoneNumberPlaceholder: "Número",
    phonePrefixPlaceholder: "Escribe el prefijo, por ejemplo +234",
    phoneTitle: "Introduce solo cifras, espacios, puntos, paréntesis o guiones.",
    childrenQuestion: "¿Participará contigo en el evento alguno de tus hijos?",
    childrenCount: "¿Cuántos de tus hijos participarán contigo?",
    childCard: (index) => `Hijo ${index}`,
    childFirstName: "Nombre",
    childLastName: "Apellidos",
    childBirthDate: "Fecha de nacimiento",
    accessibilityQuestion:
      "¿Tienes alguna discapacidad, algún problema de salud o alguna necesidad de accesibilidad que quieras comunicarnos para que podamos atenderte mejor durante el evento?",
    accessibilityTitle: "¿Qué aspectos debemos tener en cuenta?",
    previousQuestion: "¿Has participado en otros eventos de la Comunidad de Sant’Egidio?",
    externalGroupQuestion: "¿Formas parte de alguna asociación?",
    externalGroupPlaceholder: "Nombre de la asociación (opcional)",
    groupQuestion: "¿Participarás en la Oración por la Paz con un grupo de la Comunidad?",
    groupLabel: "Grupo",
    groupPlaceholder: "Busca tu grupo",
    groupDisabledPlaceholder: "Indica primero tu país, ciudad y fecha de nacimiento",
    noMatchingLeader: "No se encontró ningún grupo que coincida con la búsqueda",
    cannotFindLeader: "No encuentro mi grupo",
    daysTitle: "¿Qué días tienes previsto asistir?",
    daysHelp:
      "Selecciona las mañanas y las tardes en las que tienes previsto asistir, o indica que nos lo comunicarás más adelante.",
    daysUnknown: "Todavía no lo sé; lo comunicaré más adelante",
    privacyTitle: "Privacidad y tratamiento de datos",
    privacyBody:
      "Confirmo que he leído la información de privacidad del evento y autorizo el tratamiento de los datos introducidos para gestionar la inscripción, identificar al participante, enviar comunicaciones organizativas, organizar la acogida, gestionar posibles necesidades de accesibilidad y cumplir obligaciones de seguridad y legales relacionadas con el evento. Los datos se tratarán conforme al Reglamento UE 2016/679 (RGPD), con medidas adecuadas de confidencialidad, acceso limitado al personal autorizado y conservación solo durante el tiempo necesario para las finalidades indicadas. Sé que puedo ejercer los derechos de acceso, rectificación, supresión, limitación, oposición y retirada del consentimiento, sin afectar a la licitud del tratamiento ya realizado.",
    privacyConsent:
      "Acepto la información de privacidad y autorizo el tratamiento de los datos necesarios para gestionar la inscripción y el evento. Si inscribo a uno o más hijos, confirmo que ejerzo la responsabilidad parental o que estoy autorizado a comunicar sus datos.",
    sensitiveConsent:
      "Consiento el tratamiento de la información indicada sobre discapacidad, salud o necesidades de accesibilidad para preparar medidas de acogida y apoyo durante el evento.",
    futureEventsConsent:
      "Acepto recibir comunicaciones informativas sobre futuros eventos e iniciativas de la Comunidad de Sant'Egidio. Este consentimiento es opcional y puede retirarse en cualquier momento.",
    requiredChoice: "Selecciona una respuesta para continuar.",
    requiredGroup: "Selecciona un grupo o indica que no lo encuentras.",
    requiredDays: "Selecciona al menos una mañana o una tarde, o indica que nos lo comunicarás más adelante.",
    yes: "Sí",
    no: "No",
    submit: "Enviar inscripción",
    submitting: "Enviando inscripción...",
  },
  nl: {
    emailConfirmation: "E-mailadres bevestigen",
    emailMismatch: "De e-mailadressen moeten overeenkomen.",
    childrenHelp: "Deze functie is bedoeld voor het inschrijven van kinderen onder begeleiding die op de inschrijfdatum 0 tot en met 17 jaar oud zijn. Kinderen die je hier inschrijft, blijven voor panels en andere evenementen altijd aan jouw inschrijving gekoppeld. Als beide ouders zich voor het gebed inschrijven, vermeld de kinderen dan bij slechts één ouder.",
    newRegistration: "Nieuwe inschrijving",
    intro:
      "Vul dit formulier in om je aan te melden voor het evenement. Nadat je je inschrijving hebt verzonden, kun je je persoonlijke pagina openen en je QR-code voor toegang downloaden. Zodra het volledige programma is gepubliceerd, kun je ook kiezen aan welke panelgesprekken en andere evenementen je wilt deelnemen.",
    groupLinkPrefix: "Gebruik deze link om je in te schrijven bij de groep",
    groupLinkSuffix: ".",
    firstName: "Voornaam",
    lastName: "Achternaam",
    country: "Land waar je woont",
    countryPlaceholder: "Zoek het land waar je woont",
    countryOtherPlaceholder: "Vul het land in waar je woont",
    noCountry: "Geen land gevonden",
    city: "Stad waar je woont",
    cityPlaceholder: "Zoek de stad waar je woont",
    cityDisabledPlaceholder: "Selecteer eerst het land",
    cityOtherPlaceholder: "Vul de stad in waar je woont",
    noCity: "Geen stad gevonden",
    birthDate: "Geboortedatum",
    birthPlace: "Geboorteplaats (land en stad)",
    birthPlacePlaceholder: "Bijvoorbeeld: Italië, Rome",
    nationality: "Nationaliteit",
    nationalityPlaceholder: "Zoek je nationaliteit",
    noNationality: "Geen nationaliteit gevonden",
    phone: "Telefoonnummer (optioneel)",
    phonePrefixLabel: "Landcode",
    phoneOther: "Anders",
    phoneNumberPlaceholder: "Nummer",
    phonePrefixPlaceholder: "Vul de landcode in, bijvoorbeeld +234",
    phoneTitle: "Gebruik alleen cijfers, spaties, punten, haakjes of streepjes.",
    childrenQuestion: "Nemen een of meer van je kinderen samen met jou deel aan het evenement?",
    childrenCount: "Hoeveel van je kinderen nemen samen met jou deel?",
    childCard: (index) => `Kind ${index}`,
    childFirstName: "Voornaam",
    childLastName: "Achternaam",
    childBirthDate: "Geboortedatum",
    accessibilityQuestion:
      "Heb je een beperking, een gezondheidsprobleem of specifieke behoeften op het gebied van toegankelijkheid die je ons wilt laten weten, zodat we je tijdens het evenement beter kunnen ondersteunen?",
    accessibilityTitle: "Waar moeten we rekening mee houden?",
    previousQuestion: "Heb je aan andere evenementen van de Gemeenschap van Sant’Egidio deelgenomen?",
    externalGroupQuestion: "Ben je lid van een vereniging?",
    externalGroupPlaceholder: "Naam van de vereniging (optioneel)",
    groupQuestion: "Zul je met een groep van de Gemeenschap deelnemen aan het Gebed voor de Vrede?",
    groupLabel: "Groep",
    groupPlaceholder: "Zoek je groep",
    groupDisabledPlaceholder: "Vul eerst land, stad en geboortedatum in",
    noMatchingLeader: "Geen passende groep gevonden",
    cannotFindLeader: "Ik kan mijn groep niet vinden",
    daysTitle: "Op welke dagen denk je aanwezig te zijn?",
    daysHelp:
      "Selecteer de ochtenden en middagen waarop je wilt deelnemen, of geef aan dat je dit later laat weten.",
    daysUnknown: "Ik weet het nog niet; ik geef het later door",
    privacyTitle: "Privacy en gegevensverwerking",
    privacyBody:
      "Ik bevestig dat ik de privacyverklaring van het evenement heb gelezen en geef toestemming voor de verwerking van de ingevoerde gegevens om de inschrijving te beheren, de deelnemer te identificeren, organisatorische communicatie te verzenden, de ontvangst te organiseren, rekening te houden met eventuele toegankelijkheidsbehoeften en te voldoen aan veiligheids- en wettelijke verplichtingen rond het evenement. De gegevens worden verwerkt volgens EU-verordening 2016/679 (AVG), met passende vertrouwelijkheidsmaatregelen, toegang beperkt tot bevoegde medewerkers en bewaring alleen zolang nodig voor de genoemde doeleinden. Ik weet dat ik mijn rechten op toegang, rectificatie, verwijdering, beperking, bezwaar en intrekking van toestemming kan uitoefenen, zonder afbreuk te doen aan de rechtmatigheid van reeds uitgevoerde verwerking.",
    privacyConsent:
      "Ik accepteer de privacyverklaring en geef toestemming voor de verwerking van de gegevens die nodig zijn om de inschrijving en het evenement te beheren. Als ik een of meer kinderen inschrijf, bevestig ik dat ik ouderlijk gezag heb of bevoegd ben hun gegevens door te geven.",
    sensitiveConsent:
      "Ik stem in met de verwerking van de verstrekte informatie over een beperking, gezondheid of toegankelijkheidsbehoeften, zodat passende voorzieningen voor ontvangst en ondersteuning tijdens het evenement kunnen worden getroffen.",
    futureEventsConsent:
      "Ik ga ermee akkoord informatie te ontvangen over toekomstige evenementen en initiatieven van de Gemeenschap van Sant'Egidio. Deze toestemming is vrijwillig en kan op elk moment worden ingetrokken.",
    requiredChoice: "Selecteer een antwoord om door te gaan.",
    requiredGroup: "Selecteer een groep of geef aan dat je die niet kunt vinden.",
    requiredDays: "Selecteer ten minste één ochtend of middag, of geef aan dat je dit later laat weten.",
    yes: "Ja",
    no: "Nee",
    submit: "Inschrijving verzenden",
    submitting: "Inschrijving wordt verzonden...",
  },
  uk: {
    emailConfirmation: "Підтвердьте електронну адресу",
    emailMismatch: "Електронні адреси мають збігатися.",
    childrenHelp: "Ця функція призначена для реєстрації дітей у супроводі дорослих віком від 0 до 17 повних років на дату реєстрації. Діти, зареєстровані тут, завжди залишатимуться пов’язаними з вашою реєстрацією на панельні дискусії та інші заходи. Якщо обоє батьків реєструються на молитву, додайте дітей до реєстрації лише одного з батьків.",
    newRegistration: "Нова реєстрація",
    intro:
      "Заповніть цю форму, щоб зареєструватися на захід. Після надсилання форми ви зможете відкрити особистий кабінет і завантажити QR-код для входу. Коли буде опубліковано повну програму, ви також зможете вибрати тематичні дискусії та інші заходи, у яких хочете взяти участь.",
    groupLinkPrefix: "Скористайтеся цим посиланням, щоб зареєструватися у складі групи",
    groupLinkSuffix: ".",
    firstName: "Ім'я",
    lastName: "Прізвище",
    country: "Країна, де ви зазвичай живете",
    countryPlaceholder: "Знайдіть країну, де ви живете",
    countryOtherPlaceholder: "Вкажіть країну, де ви живете",
    noCountry: "Країну не знайдено",
    city: "Місто, де ви зазвичай живете",
    cityPlaceholder: "Знайдіть місто, де ви живете",
    cityDisabledPlaceholder: "Спочатку виберіть країну",
    cityOtherPlaceholder: "Вкажіть місто, де ви живете",
    noCity: "Місто не знайдено",
    birthDate: "Дата народження",
    birthPlace: "Місце народження (країна і місто)",
    birthPlacePlaceholder: "Наприклад: Італія, Рим",
    nationality: "Громадянство",
    nationalityPlaceholder: "Знайдіть своє громадянство",
    noNationality: "Громадянство не знайдено",
    phone: "Телефон (необов'язково)",
    phonePrefixLabel: "Міжнародний телефонний код",
    phoneOther: "Інше",
    phoneNumberPlaceholder: "Номер",
    phonePrefixPlaceholder: "Введіть телефонний код, наприклад +234",
    phoneTitle: "Вводьте лише цифри, пробіли, крапки, дужки або дефіси.",
    childrenQuestion: "Чи братимуть участь у заході разом із вами ваші діти?",
    childrenCount: "Скільки ваших дітей братимуть участь разом із вами?",
    childCard: (index) => `Дитина ${index}`,
    childFirstName: "Ім’я",
    childLastName: "Прізвище",
    childBirthDate: "Дата народження",
    accessibilityQuestion:
      "Чи є у вас інвалідність, особливості стану здоров'я або потреби щодо доступності, про які ви хотіли б нам повідомити, щоб ми могли краще організувати вашу участь у заході?",
    accessibilityTitle: "Що нам потрібно врахувати?",
    previousQuestion: "Чи брали ви участь в інших заходах Спільноти святого Егідія?",
    externalGroupQuestion: "Чи належите ви до якоїсь асоціації?",
    externalGroupPlaceholder: "Назва асоціації (необов’язково)",
    groupQuestion: "Чи братимете ви участь у Молитві за мир з групою Спільноти?",
    groupLabel: "Група",
    groupPlaceholder: "Знайдіть свою групу",
    groupDisabledPlaceholder: "Спочатку вкажіть країну, місто і дату народження",
    noMatchingLeader: "Відповідну групу не знайдено",
    cannotFindLeader: "Я не можу знайти свою групу",
    daysTitle: "У які дні ви плануєте бути присутніми?",
    daysHelp:
      "Виберіть ранкові та післяобідні години, коли ви плануєте бути присутніми, або вкажіть, що повідомите про це пізніше.",
    daysUnknown: "Я ще не знаю, повідомлю пізніше",
    privacyTitle: "Конфіденційність і обробка даних",
    privacyBody:
      "Я підтверджую, що прочитав/прочитала повідомлення про конфіденційність події, і дозволяю обробку введених даних для опрацювання реєстрації, ідентифікації учасника, надсилання організаційних повідомлень, організації прийому, врахування можливих потреб щодо доступності та виконання вимог безпеки й законодавства, пов'язаних із заходом. Дані оброблятимуться відповідно до Регламенту ЄС 2016/679 (GDPR), із належними заходами конфіденційності, доступом лише для уповноважених осіб і зберіганням лише протягом часу, необхідного для зазначених цілей. Я знаю, що можу здійснювати права доступу, виправлення, видалення, обмеження, заперечення та відкликання згоди, без шкоди для законності вже здійсненої обробки.",
    privacyConsent:
      "Я приймаю повідомлення про конфіденційність і дозволяю обробку даних, необхідних для опрацювання реєстрації та організації заходу. Якщо я реєструю одну або кількох дітей, я підтверджую, що маю батьківські права або уповноважений/уповноважена надати їхні дані.",
    sensitiveConsent:
      "Я погоджуюся на обробку наданої інформації про інвалідність, стан здоров'я або потреби щодо доступності, щоб забезпечити належний прийом і підтримку під час заходу.",
    futureEventsConsent:
      "Я погоджуюся отримувати інформаційні повідомлення про майбутні заходи та ініціативи Спільноти святого Егідія. Ця згода є добровільною і може бути відкликана в будь-який час.",
    requiredChoice: "Виберіть відповідь, щоб продовжити.",
    requiredGroup: "Виберіть групу або вкажіть, що не можете її знайти.",
    requiredDays: "Виберіть принаймні один ранковий або післяобідній період або вкажіть, що повідомите про свою присутність пізніше.",
    yes: "Так",
    no: "Ні",
    submit: "Надіслати реєстрацію",
    submitting: "Надсилання реєстрації...",
  },
};

export function RegistrationForm({
  email,
  error,
  groupRegistrationLinkToken,
  identitySuggestion,
  locale,
  options,
}: RegistrationFormProps) {
  const copy = REGISTRATION_FORM_COPY[locale] ?? REGISTRATION_FORM_COPY.en;
  const childDateBounds = publicChildBirthDateBounds();
  const formRef = useRef<HTMLFormElement>(null);
  const submittedRef = useRef(false);
  const [hasAccessibilityNeeds, setHasAccessibilityNeeds] = useState("");
  const [hasPreviousParticipation, setHasPreviousParticipation] = useState("");
  const [participatesWithGroup, setParticipatesWithGroup] = useState("");
  const effectiveHasPreviousParticipation = options.groupLink
    ? "yes"
    : hasPreviousParticipation;
  const effectiveParticipatesWithGroup = options.groupLink
    ? "yes"
    : hasPreviousParticipation === "no"
      ? "no"
      : hasPreviousParticipation === "yes"
        ? participatesWithGroup
        : "";
  const [birthDate, setBirthDate] = useState("");
  const [countrySearch, setCountrySearch] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [customCountry, setCustomCountry] = useState("");
  const [showCountryOptions, setShowCountryOptions] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [customCity, setCustomCity] = useState("");
  const [showCityOptions, setShowCityOptions] = useState(false);
  const [nationalitySearch, setNationalitySearch] = useState("");
  const [selectedNationality, setSelectedNationality] = useState("");
  const [showNationalityOptions, setShowNationalityOptions] = useState(false);
  const [groupSearch, setGroupSearch] = useState(
    options.groupLink?.displayLabel ?? ""
  );
  const [showGroupOptions, setShowGroupOptions] = useState(false);
  const [cannotFindLeader, setCannotFindLeader] = useState(false);
  const [selectedGroupValue, setSelectedGroupValue] = useState(
    options.groupLink?.groupId ?? ""
  );
  const [phonePrefix, setPhonePrefix] = useState("+39");
  const [customPhonePrefix, setCustomPhonePrefix] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [participatesWithChildren, setParticipatesWithChildren] = useState("no");
  const [childrenCount, setChildrenCount] = useState(1);
  const [selectedAttendanceSlots, setSelectedAttendanceSlots] = useState<string[]>([]);
  const [availabilityUnknown, setAvailabilityUnknown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(Boolean(error));
  const [touchedPromptFields, setTouchedPromptFields] = useState<
    Partial<Record<PromptField, boolean>>
  >({});

  const attendanceDayColumns = buildAttendanceDayColumns(
    options.event?.starts_on ?? null,
    options.event?.ends_on ?? null,
    locale
  );
  const filteredCountries = EUROPEAN_COUNTRIES.filter((country) =>
    [country, countryName(country, locale) ?? country].some(name =>
      normalizeSearchText(name).includes(normalizeSearchText(countrySearch))
    )
  );
  const countryValue =
    selectedCountry === OTHER_COUNTRY ? customCountry : selectedCountry;
  const cityOptions =
    selectedCountry && selectedCountry !== OTHER_COUNTRY
      ? EUROPEAN_CITY_OPTIONS[selectedCountry] ?? []
      : [];
  const filteredCities = cityOptions.filter((city) =>
    normalizeSearchText(city).includes(normalizeSearchText(citySearch))
  );
  const cityValue = selectedCity === OTHER_CITY ? customCity : selectedCity;
  const selectedCountryId = findCountryId(options.countries, countryValue);
  const selectedCityId = selectedCountryId
    ? findCityId(options.cities, selectedCountryId, cityValue)
    : null;
  const matchingGroups = findMatchingGroupCandidates(
    options.groups,
    {
      countryId: selectedCountryId,
      cityId: selectedCityId,
      birthDate,
      eventStartsOn: options.event?.starts_on ?? null,
    },
    { publicOnly: true }
  );
  const searchedGroups = matchingGroups.filter((group) =>
    normalizeMatchText(formatGroupOptionLabel(group)).includes(
      normalizeMatchText(groupSearch)
    )
  );
  const hasGroupLink = Boolean(options.groupLink);
  const hasRealGroups = options.groups.length > 0 || hasGroupLink;
  const groupOptions = hasRealGroups
    ? searchedGroups.map((group) => ({
        value: group.id,
        label: formatGroupOptionLabel(group),
      }))
    : PLACEHOLDER_GROUPS.map((group) => ({ value: group, label: group }));
  const filteredNationalities = NATIONALITY_OPTIONS.filter((nationality) =>
    normalizeSearchText(nationality).includes(normalizeSearchText(nationalitySearch))
  );
  const normalizedPhoneNumber = phoneNumber.replace(/[\s().-]/g, "");
  const selectedPhonePrefix =
    phonePrefix === OTHER_PHONE_PREFIX ? customPhonePrefix.trim() : phonePrefix;
  const phoneValue = normalizedPhoneNumber
    ? `${selectedPhonePrefix}${normalizedPhoneNumber}`
    : "";
  const markPromptFieldTouched = useCallback((field: PromptField) => {
    setTouchedPromptFields((current) =>
      current[field] ? current : { ...current, [field]: true }
    );
  }, []);
  const shouldShowPrompt = useCallback(
    (field: PromptField) =>
      hasAttemptedSubmit || Boolean(error) || Boolean(touchedPromptFields[field]),
    [error, hasAttemptedSubmit, touchedPromptFields]
  );

  const saveCurrentForm = useCallback(() => {
    const form = formRef.current;

    if (!form) {
      return;
    }

    writeStoredForm(email, form, {
      hasAccessibilityNeeds,
      hasPreviousParticipation,
      participatesWithGroup,
      birthDate,
      countrySearch,
      selectedCountry,
      customCountry,
      citySearch,
      selectedCity,
      customCity,
      nationalitySearch,
      selectedNationality,
      groupSearch,
      cannotFindLeader,
      selectedGroupValue,
      phonePrefix,
      customPhonePrefix,
      phoneNumber,
      participatesWithChildren,
      childrenCount,
      selectedAttendanceSlots,
      availabilityUnknown,
    });
  }, [
    email,
    hasAccessibilityNeeds,
    hasPreviousParticipation,
    participatesWithGroup,
    birthDate,
    countrySearch,
    selectedCountry,
    customCountry,
    citySearch,
    selectedCity,
    customCity,
    nationalitySearch,
    selectedNationality,
    groupSearch,
    cannotFindLeader,
    selectedGroupValue,
    phonePrefix,
    customPhonePrefix,
    phoneNumber,
    participatesWithChildren,
    childrenCount,
    selectedAttendanceSlots,
    availabilityUnknown,
  ]);

  useEffect(() => {
    const saveTimer = window.setTimeout(saveCurrentForm, 0);

    return () => window.clearTimeout(saveTimer);
  }, [saveCurrentForm]);

  useEffect(() => {
    if (!error || !email) {
      return;
    }

    const stored = readStoredForm(email);

    if (!stored) {
      focusFieldForError(formRef.current, error);
      return;
    }

    const restoreTimer = window.setTimeout(() => {
      setHasAccessibilityNeeds(stored.state.hasAccessibilityNeeds);
      setHasPreviousParticipation(
        stored.state.hasPreviousParticipation
      );
      setParticipatesWithGroup(
        stored.state.hasPreviousParticipation === "yes"
          ? stored.state.participatesWithGroup
          : ""
      );
      setBirthDate(stored.state.birthDate);
      setCountrySearch(stored.state.countrySearch);
      setSelectedCountry(stored.state.selectedCountry);
      setCustomCountry(stored.state.customCountry);
      setCitySearch(stored.state.citySearch);
      setSelectedCity(stored.state.selectedCity);
      setCustomCity(stored.state.customCity);
      setNationalitySearch(stored.state.nationalitySearch);
      setSelectedNationality(stored.state.selectedNationality);
      setGroupSearch(options.groupLink?.displayLabel ?? stored.state.groupSearch);
      setCannotFindLeader(options.groupLink ? false : stored.state.cannotFindLeader);
      setSelectedGroupValue(
        options.groupLink?.groupId ?? stored.state.selectedGroupValue
      );
      setPhonePrefix(stored.state.phonePrefix);
      setCustomPhonePrefix(stored.state.customPhonePrefix);
      setPhoneNumber(stored.state.phoneNumber);
      setParticipatesWithChildren(
        stored.state.participatesWithChildren === "yes" ? "yes" : "no"
      );
      setChildrenCount(
        Number.isInteger(stored.state.childrenCount) &&
          stored.state.childrenCount >= 1 &&
          stored.state.childrenCount <= 10
          ? stored.state.childrenCount
          : 1
      );
      setSelectedAttendanceSlots(
        stored.state.selectedAttendanceSlots ??
          stored.state.selectedEventDays?.flatMap((day) => [
            encodeAttendanceSlot({ day, part: "morning" }),
            encodeAttendanceSlot({ day, part: "afternoon" }),
          ]) ??
          []
      );
      setAvailabilityUnknown(stored.state.availabilityUnknown);

      window.setTimeout(() => {
        restoreNativeFields(formRef.current, stored);
        focusFieldForError(formRef.current, error);
      }, 0);
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, [email, error, options.groupLink]);

  function validateEmailConfirmation() {
    const form = formRef.current;
    const first = form?.elements.namedItem("email") as HTMLInputElement | null;
    const confirmation = form?.elements.namedItem("emailConfirmation") as HTMLInputElement | null;
    if (first && confirmation) {
      confirmation.setCustomValidity(
        confirmation.value && first.value.trim().toLowerCase() !== confirmation.value.trim().toLowerCase()
          ? copy.emailMismatch : ""
      );
    }
  }

  function clearCitySelection() {
    setCitySearch("");
    setSelectedCity("");
    setCustomCity("");
    setShowCityOptions(false);
    if (!hasGroupLink) {
      setGroupSearch("");
      setCannotFindLeader(false);
      setSelectedGroupValue("");
    }
  }

  return (
    <form
      ref={formRef}
      action={submitPublicRegistration}
      className="app-container grid gap-6 py-8 sm:py-10"
      onChange={saveCurrentForm}
      onInput={saveCurrentForm}
      onSubmit={(event) => {
        if (submittedRef.current) {
          event.preventDefault();
          return;
        }

        validateEmailConfirmation();
        if (!event.currentTarget.reportValidity()) {
          event.preventDefault();
          return;
        }
        saveCurrentForm();

        if (
          !hasAccessibilityNeeds ||
          !effectiveHasPreviousParticipation ||
          !effectiveParticipatesWithGroup ||
          (effectiveParticipatesWithGroup === "yes" &&
            !cannotFindLeader &&
            !selectedGroupValue) ||
          (!availabilityUnknown && selectedAttendanceSlots.length === 0)
        ) {
          event.preventDefault();
          setHasAttemptedSubmit(true);
          focusClientSideMissingField(formRef.current, {
            hasAccessibilityNeeds,
            hasPreviousParticipation: effectiveHasPreviousParticipation,
            participatesWithGroup: effectiveParticipatesWithGroup,
            availabilityUnknown,
            selectedAttendanceSlots,
            needsGroupChoice:
              effectiveParticipatesWithGroup === "yes" &&
              !cannotFindLeader &&
              !selectedGroupValue,
          });
          return;
        }

        submittedRef.current = true;
        setIsSubmitting(true);
      }}
    >
      {groupRegistrationLinkToken ? (
        <input
          name="groupRegistrationLinkToken"
          type="hidden"
          value={groupRegistrationLinkToken}
        />
      ) : null}
      <header className="surface-card overflow-hidden">
        <div className="relative isolate event-gradient px-5 py-7 text-white sm:px-7">
          <EventIdentity compact inverted />
        </div>
        <div className="px-5 py-5 sm:px-7">
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--peace-blue-800)]">
            {copy.newRegistration}
          </p>
          <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
            {options.event?.title}
          </h2>
          <p className="mt-3 text-[var(--peace-muted)]">
            {copy.intro}
          </p>
          {error ? (
            <p className="status-error mt-4 rounded-[var(--radius-sm)] border px-3 py-2 text-sm">
              {error}
            </p>
          ) : null}
          {options.groupLink ? (
            <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--peace-border-strong)] bg-[#f4fafe] px-4 py-3 text-sm text-[var(--peace-ink)]">
              <p className="font-semibold">
                {copy.groupLinkPrefix}{" "}
                <span className="text-[var(--peace-blue-900)]">
                  “{options.groupLink.displayLabel}”
                </span>
                {copy.groupLinkSuffix}
              </p>
            </div>
          ) : null}
        </div>
      </header>

      <RequiredFieldsNote locale={locale} />

      <section className="grid gap-4 rounded-lg border border-[var(--peace-border)] bg-white p-5 sm:grid-cols-2">
        <Field required label="Email" className="sm:col-span-2">
          <input
            name="email"
            type="email"
            required
            defaultValue={email}
            className="field"
            autoComplete="email"
            onInput={validateEmailConfirmation}
            data-field="email"
          />
        </Field>
        <Field required label={copy.emailConfirmation} className="sm:col-span-2">
          <input
            name="emailConfirmation"
            type="email"
            required
            className="field"
            autoComplete="off"
            onInput={validateEmailConfirmation}
            data-field="emailConfirmation"
          />
        </Field>
        <Field required label={copy.firstName}>
          <input
            name="firstName"
            required
            className="field"
            autoComplete="given-name"
            defaultValue={identitySuggestion?.firstName ?? ""}
            data-field="firstName"
          />
        </Field>
        <Field required label={copy.lastName}>
          <input
            name="lastName"
            required
            className="field"
            autoComplete="family-name"
            defaultValue={identitySuggestion?.lastName ?? ""}
            data-field="lastName"
          />
        </Field>
        <div className="grid gap-2 text-sm font-medium text-[var(--peace-ink)]">
          <span>{copy.country}<RequiredIndicator /></span>
          <input type="hidden" name="countryOther" value={countryValue} />
          <div className="relative">
            <input
              className="field"
              placeholder={copy.countryPlaceholder}
              required
              value={countrySearch}
              data-field="country"
              onBlur={() => {
                window.setTimeout(() => setShowCountryOptions(false), 120);
              }}
              onChange={(event) => {
                setCountrySearch(event.target.value);
                setSelectedCountry("");
                setShowCountryOptions(true);
              }}
              onFocus={() => setShowCountryOptions(true)}
            />
            {showCountryOptions ? (
              <div className="absolute z-10 mt-2 max-h-64 w-full overflow-auto rounded-md border border-[var(--peace-border-strong)] bg-white shadow-lg">
                {(filteredCountries.length > 0
                  ? filteredCountries
                    : [copy.noCountry]
                ).map((country) => (
                  <button
                    key={country}
                    type="button"
                    disabled={country === copy.noCountry}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--peace-sky-100)] disabled:cursor-default disabled:text-[#718196] disabled:hover:bg-white"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      if (country === copy.noCountry) {
                        return;
                      }

                      setSelectedCountry(country);
                      setCountrySearch(countryName(country, locale) ?? country);
                      setCustomCountry("");
                      clearCitySelection();
                      setShowCountryOptions(false);
                    }}
                  >
                    {countryName(country, locale)}
                  </button>
                ))}
                <button
                  type="button"
                  className="block w-full border-t border-[var(--peace-border)] px-3 py-2 text-left text-sm font-medium text-[var(--peace-blue-800)] hover:bg-[var(--peace-sky-100)]"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setSelectedCountry(OTHER_COUNTRY);
                    setCountrySearch(OTHER_COUNTRY);
                    clearCitySelection();
                    setShowCountryOptions(false);
                  }}
                >
                  {OTHER_COUNTRY}
                </button>
              </div>
            ) : null}
          </div>
          {selectedCountry === OTHER_COUNTRY ? (
            <input
              className="field"
              placeholder={copy.countryOtherPlaceholder}
              required
              value={customCountry}
              data-field="country"
              onChange={(event) => {
                event.target.setCustomValidity(
                  event.target.value.trim() && !isCountryName(event.target.value)
                    ? COUNTRY_VALIDATION_MESSAGE[locale] : ""
                );
                setCustomCountry(event.target.value);
                clearCitySelection();
              }}
            />
          ) : null}
        </div>
        <div className="grid gap-2 text-sm font-medium text-[var(--peace-ink)]">
          <span>{copy.city}<RequiredIndicator /></span>
          <input type="hidden" name="cityOther" value={cityValue} />
          {selectedCountry === OTHER_COUNTRY ? (
            <input
              className="field"
              placeholder={copy.cityOtherPlaceholder}
              required
              value={customCity}
              data-field="city"
              onChange={(event) => {
                setSelectedCity(OTHER_CITY);
                setCustomCity(event.target.value);
              }}
            />
          ) : (
            <div className="relative">
              <input
                className="field"
                placeholder={
                  selectedCountry
                    ? copy.cityPlaceholder
                    : copy.cityDisabledPlaceholder
                }
                required
                disabled={!selectedCountry}
                value={citySearch}
                data-field="city"
                onBlur={() => {
                  window.setTimeout(() => setShowCityOptions(false), 120);
                }}
                onChange={(event) => {
                  setCitySearch(event.target.value);
                  setSelectedCity("");
                  setShowCityOptions(true);
                }}
                onFocus={() => {
                  if (selectedCountry) {
                    setShowCityOptions(true);
                  }
                }}
              />
              {showCityOptions && selectedCountry ? (
                <div className="absolute z-10 mt-2 max-h-64 w-full overflow-auto rounded-md border border-[var(--peace-border-strong)] bg-white shadow-lg">
                  {(filteredCities.length > 0
                    ? filteredCities
                    : [copy.noCity]
                  ).map((city) => (
                    <button
                      key={city}
                      type="button"
                      disabled={city === copy.noCity}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--peace-sky-100)] disabled:cursor-default disabled:text-[#718196] disabled:hover:bg-white"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        if (city === copy.noCity) {
                          return;
                        }

                        setSelectedCity(city);
                        setCitySearch(city);
                        setCustomCity("");
                        setShowCityOptions(false);
                      }}
                    >
                      {city}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="block w-full border-t border-[var(--peace-border)] px-3 py-2 text-left text-sm font-medium text-[var(--peace-blue-800)] hover:bg-[var(--peace-sky-100)]"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setSelectedCity(OTHER_CITY);
                      setCitySearch(OTHER_CITY);
                      setShowCityOptions(false);
                    }}
                  >
                    {OTHER_CITY}
                  </button>
                </div>
              ) : null}
            </div>
          )}
          {selectedCountry !== OTHER_COUNTRY && selectedCity === OTHER_CITY ? (
            <input
              className="field"
              placeholder={copy.cityOtherPlaceholder}
              required
              value={customCity}
              data-field="city"
              onChange={(event) => setCustomCity(event.target.value)}
            />
          ) : null}
        </div>
        <Field required label={copy.birthDate}>
          <input
            name="birthDate"
            type="date"
            required
            className="field"
            value={birthDate}
            data-field="birthDate"
            onChange={(event) => setBirthDate(event.target.value)}
          />
        </Field>
        <Field required label={copy.birthPlace}>
          <input
            name="birthPlace"
            required
            className="field"
            autoComplete="off"
            placeholder={copy.birthPlacePlaceholder}
            data-field="birthPlace"
          />
        </Field>
        <div className="grid gap-2 text-sm font-medium text-[var(--peace-ink)]">
          <span>{copy.nationality}<RequiredIndicator /></span>
          <input type="hidden" name="nationality" value={selectedNationality} />
          <div className="relative">
            <input
              className="field"
              placeholder={copy.nationalityPlaceholder}
              required
              value={nationalitySearch}
              data-field="nationality"
              onBlur={() => {
                window.setTimeout(() => setShowNationalityOptions(false), 120);
              }}
              onChange={(event) => {
                setNationalitySearch(event.target.value);
                setSelectedNationality("");
                setShowNationalityOptions(true);
              }}
              onFocus={() => setShowNationalityOptions(true)}
            />
            {showNationalityOptions ? (
              <div className="absolute z-10 mt-2 max-h-64 w-full overflow-auto rounded-md border border-[var(--peace-border-strong)] bg-white shadow-lg">
                {(filteredNationalities.length > 0
                  ? filteredNationalities
                  : [copy.noNationality]
                ).map((nationality) => (
                  <button
                    key={nationality}
                    type="button"
                    disabled={nationality === copy.noNationality}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--peace-sky-100)] disabled:cursor-default disabled:text-[#718196] disabled:hover:bg-white"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      if (nationality === copy.noNationality) {
                        return;
                      }

                      setSelectedNationality(nationality);
                      setNationalitySearch(nationality);
                      setShowNationalityOptions(false);
                    }}
                  >
                    {nationality}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="grid gap-2 text-sm font-medium text-[var(--peace-ink)]">
          <span>{copy.phone}</span>
          <input type="hidden" name="phone" value={phoneValue} />
          <div className="grid gap-2 sm:grid-cols-[minmax(8rem,12rem)_1fr]">
            <select
              className="field"
              value={phonePrefix}
              onChange={(event) => {
                setPhonePrefix(event.target.value);
                if (event.target.value !== OTHER_PHONE_PREFIX) {
                  setCustomPhonePrefix("");
                }
              }}
              aria-label={copy.phonePrefixLabel}
            >
              {PHONE_PREFIX_OPTIONS.map((prefix) => (
                <option key={`${prefix.value}-${prefix.label}`} value={prefix.value}>
                  {prefix.label}
                </option>
              ))}
              <option value={OTHER_PHONE_PREFIX}>{copy.phoneOther}</option>
            </select>
            <input
              type="tel"
              className="field"
              autoComplete="tel-national"
              inputMode="tel"
              pattern="[0-9 .()\\-]{4,14}"
              title={copy.phoneTitle}
              placeholder={copy.phoneNumberPlaceholder}
              value={phoneNumber}
              data-field="phone"
              onChange={(event) => setPhoneNumber(event.target.value)}
            />
          </div>
          {phonePrefix === OTHER_PHONE_PREFIX ? (
            <Field label={copy.phonePrefixLabel} required={phoneNumber.length > 0}>
              <input
                className="field"
                inputMode="tel"
                pattern="\\+[1-9][0-9]{0,3}"
                placeholder={copy.phonePrefixPlaceholder}
                required={phoneNumber.length > 0}
                title={copy.phonePrefixLabel}
                value={customPhonePrefix}
                data-field="phone"
                onChange={(event) => setCustomPhonePrefix(event.target.value)}
              />
            </Field>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border border-[var(--peace-border)] bg-white p-5">
        <div className="grid gap-3 text-sm font-medium text-[var(--peace-ink)]">
          <span>{copy.childrenQuestion}</span>
          <input
            name="participatesWithChildren"
            type="hidden"
            value={participatesWithChildren}
          />
          <div className="grid grid-cols-2 gap-3 sm:max-w-xs">
            <ChoiceButton
              active={participatesWithChildren === "yes"}
              label={copy.yes}
              dataField="participatesWithChildren"
              onClick={() => setParticipatesWithChildren("yes")}
            />
            <ChoiceButton
              active={participatesWithChildren === "no"}
              label={copy.no}
              dataField="participatesWithChildren"
              onClick={() => setParticipatesWithChildren("no")}
            />
          </div>
        </div>

        {participatesWithChildren === "yes" ? (
          <div className="grid gap-4">
            <p id="children-help" className="text-sm text-[var(--peace-muted)]">{copy.childrenHelp}</p>
            <Field required label={copy.childrenCount}>
              <select
                name="childrenCount"
                className="field"
                value={childrenCount}
                onChange={(event) => setChildrenCount(Number(event.target.value))}
              >
                {Array.from({ length: 10 }, (_, index) => index + 1).map(
                  (count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  )
                )}
              </select>
            </Field>

            <div className="grid gap-4">
              {Array.from({ length: childrenCount }, (_, index) => (
                <fieldset
                  key={index}
                  className="grid gap-3 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-4 sm:grid-cols-2"
                >
                  <legend className="px-2 text-sm font-semibold text-[var(--peace-blue-900)]">
                    {copy.childCard(index + 1)}
                  </legend>
                  <Field required label={copy.childFirstName}>
                    <input
                      name={`child_${index}_firstName`}
                      required
                      className="field bg-white"
                      autoComplete="off"
                      data-field="children"
                    />
                  </Field>
                  <Field required label={copy.childLastName}>
                    <input
                      name={`child_${index}_lastName`}
                      required
                      className="field bg-white"
                      autoComplete="off"
                      data-field="children"
                    />
                  </Field>
                  <Field required label={copy.childBirthDate} className="sm:col-span-2">
                    <input
                      name={`child_${index}_birthDate`}
                      type="date"
                      min={childDateBounds.min}
                      max={childDateBounds.max}
                      aria-describedby="children-help"
                      required
                      className="field bg-white"
                      autoComplete="off"
                      data-field="children"
                    />
                  </Field>
                </fieldset>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 rounded-lg border border-[var(--peace-border)] bg-white p-5">
        <div className="grid gap-3 text-sm font-medium text-[var(--peace-ink)]">
          <span>{copy.accessibilityQuestion}<RequiredIndicator /></span>
          <input
            name="hasAccessibilityNeeds"
            type="hidden"
            value={hasAccessibilityNeeds}
          />
          <div className="grid grid-cols-2 gap-3 sm:max-w-xs">
            <ChoiceButton
              active={hasAccessibilityNeeds === "yes"}
              label={copy.yes}
              dataField="hasAccessibilityNeeds"
              onClick={() => {
                markPromptFieldTouched("hasAccessibilityNeeds");
                setHasAccessibilityNeeds("yes");
              }}
            />
            <ChoiceButton
              active={hasAccessibilityNeeds === "no"}
              label={copy.no}
              dataField="hasAccessibilityNeeds"
              onClick={() => {
                markPromptFieldTouched("hasAccessibilityNeeds");
                setHasAccessibilityNeeds("no");
              }}
            />
          </div>
          {!hasAccessibilityNeeds && shouldShowPrompt("hasAccessibilityNeeds") ? (
            <p className="text-xs text-[#8a3323]">
              {copy.requiredChoice}
            </p>
          ) : null}
        </div>

        {hasAccessibilityNeeds === "yes" ? (
          <div className="grid gap-4">
            <div>
              <h2 className="text-lg font-semibold">
                {copy.accessibilityTitle}<RequiredIndicator />
              </h2>
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
                    className="mt-1 h-4 w-4"
                    data-field="accessibilityAnswers"
                  />
                  <span>{difficulty.label[locale] ?? difficulty.label.en}</span>
                </label>
              ))}
            </div>
            <p className="text-sm leading-6 text-[var(--peace-muted)]">
              {ACCESSIBILITY_COMMUNICATION_HELP[locale]}
            </p>
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 rounded-lg border border-[var(--peace-border)] bg-white p-5">
        <input
          name="hasPreviousSantegidioParticipation"
          type="hidden"
          value={effectiveHasPreviousParticipation}
        />
        {!hasGroupLink ? (
          <div className="grid gap-3 text-sm font-medium text-[var(--peace-ink)]">
            <span>{copy.previousQuestion}<RequiredIndicator /></span>
            <div className="grid grid-cols-2 gap-3 sm:max-w-xs">
              <ChoiceButton
                active={hasPreviousParticipation === "yes"}
                label={copy.yes}
                dataField="hasPreviousSantegidioParticipation"
                onClick={() => {
                  markPromptFieldTouched("hasPreviousSantegidioParticipation");
                  setHasPreviousParticipation("yes");
                }}
              />
              <ChoiceButton
                active={hasPreviousParticipation === "no"}
                label={copy.no}
                dataField="hasPreviousSantegidioParticipation"
                onClick={() => {
                  markPromptFieldTouched("hasPreviousSantegidioParticipation");
                  setHasPreviousParticipation("no");
                  setParticipatesWithGroup("");
                  setCannotFindLeader(false);
                  setSelectedGroupValue(options.groupLink?.groupId ?? "");
                  setGroupSearch(options.groupLink?.displayLabel ?? "");
                  setShowGroupOptions(false);
                }}
              />
            </div>
            {!hasPreviousParticipation &&
            shouldShowPrompt("hasPreviousSantegidioParticipation") ? (
              <p className="text-xs text-[#8a3323]">
                {copy.requiredChoice}
              </p>
            ) : null}
          </div>
        ) : null}

        <input
          name="participatesWithGroup"
          type="hidden"
          value={effectiveParticipatesWithGroup}
        />
        {!hasGroupLink && hasPreviousParticipation === "yes" ? (
          <div className="grid gap-3 text-sm font-medium text-[var(--peace-ink)]">
            <span>{copy.groupQuestion}<RequiredIndicator /></span>
            <div className="grid grid-cols-2 gap-3 sm:max-w-xs">
              <ChoiceButton
                active={participatesWithGroup === "yes"}
                label={copy.yes}
                dataField="participatesWithGroup"
                onClick={() => {
                  markPromptFieldTouched("participatesWithGroup");
                  setParticipatesWithGroup("yes");
                  setCannotFindLeader(false);
                }}
              />
              <ChoiceButton
                active={participatesWithGroup === "no"}
                label={copy.no}
                dataField="participatesWithGroup"
                onClick={() => {
                  markPromptFieldTouched("participatesWithGroup");
                  setParticipatesWithGroup("no");
                  setCannotFindLeader(false);
                  setSelectedGroupValue(options.groupLink?.groupId ?? "");
                  setGroupSearch(options.groupLink?.displayLabel ?? "");
                  setShowGroupOptions(false);
                }}
              />
            </div>
            {!participatesWithGroup &&
            shouldShowPrompt("participatesWithGroup") ? (
              <p className="text-xs text-[#8a3323]">
                {copy.requiredChoice}
              </p>
            ) : null}
          </div>
        ) : null}

        {effectiveParticipatesWithGroup === "no" ? (
          <Field label={copy.externalGroupQuestion}>
            <input
              name="externalGroupAssociation"
              className="field"
              placeholder={copy.externalGroupPlaceholder}
            />
          </Field>
        ) : null}

        {effectiveParticipatesWithGroup === "yes" ? (
          <Field required={!hasGroupLink && !cannotFindLeader} label={copy.groupLabel}>
            <input
              name={hasRealGroups ? "groupId" : "groupName"}
              value={selectedGroupValue}
              readOnly
              type="hidden"
            />
            {options.groupLink ? (
              <input
                className="field bg-[var(--peace-soft)]"
                readOnly
                value={options.groupLink.displayLabel}
                data-field="group"
              />
            ) : (
              <>
                <div className="relative">
                  <input
                    className="field"
                    placeholder={
                      selectedCountryId && birthDate
                        ? copy.groupPlaceholder
                        : copy.groupDisabledPlaceholder
                    }
                    required={!cannotFindLeader}
                    disabled={cannotFindLeader || !selectedCountryId || !birthDate}
                    value={groupSearch}
                    data-field="group"
                    onBlur={() => {
                      window.setTimeout(() => setShowGroupOptions(false), 120);
                    }}
                    onChange={(event) => {
                      setGroupSearch(event.target.value);
                      setSelectedGroupValue("");
                      setShowGroupOptions(true);
                    }}
                    onFocus={() => {
                      if (!cannotFindLeader && selectedCountryId && birthDate) {
                        setShowGroupOptions(true);
                      }
                    }}
                  />
                  {showGroupOptions && !cannotFindLeader ? (
                    <div className="absolute z-10 mt-2 max-h-64 w-full overflow-auto rounded-md border border-[var(--peace-border-strong)] bg-white shadow-lg">
                      {(groupOptions.length > 0
                        ? groupOptions
                        : [
                            {
                              value: "",
                              label: selectedCountryId
                                ? copy.noMatchingLeader
                                : copy.groupDisabledPlaceholder,
                            },
                          ]
                      ).map((group) => (
                        <button
                          key={`${group.value}-${group.label}`}
                          type="button"
                          disabled={!group.value}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--peace-sky-100)] disabled:cursor-default disabled:text-[#718196] disabled:hover:bg-white"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            if (!group.value) {
                              return;
                            }

                            setSelectedGroupValue(group.value);
                            setGroupSearch(group.label);
                            setShowGroupOptions(false);
                          }}
                        >
                          {group.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                {hasRealGroups && groupOptions.length === 0 ? (
                  <span className="text-xs font-normal text-[var(--peace-muted)]">
                    {copy.noMatchingLeader}
                  </span>
                ) : null}
                <label className="flex items-start gap-3 text-sm font-normal text-[var(--peace-ink)]">
                  <input
                    name="cannotFindLeader"
                    type="checkbox"
                    checked={cannotFindLeader}
                    className="mt-1 h-4 w-4"
                    data-field="group"
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setCannotFindLeader(checked);
                      if (checked) {
                        setSelectedGroupValue("");
                        setGroupSearch("");
                        setShowGroupOptions(false);
                      }
                    }}
                  />
                  <span>{copy.cannotFindLeader}</span>
                </label>
              </>
            )}
          </Field>
        ) : null}
      </section>

      <section className="grid gap-4 rounded-lg border border-[var(--peace-border)] bg-white p-5">
        <div>
          <h2 className="text-lg font-semibold">
            {copy.daysTitle}<RequiredIndicator />
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--peace-muted)]">
            {copy.daysHelp}
          </p>
        </div>
        <AttendanceSlotTable
          columns={attendanceDayColumns}
          disabled={availabilityUnknown}
          selectedSlots={selectedAttendanceSlots}
          locale={locale}
          onToggle={(slotValue, checked) => {
            markPromptFieldTouched("availabilityDays");
            setSelectedAttendanceSlots((current) =>
              checked
                ? [...current, slotValue]
                : current.filter((value) => value !== slotValue)
            );
          }}
        />
        <label className="flex min-h-14 items-center gap-3 rounded-md border border-[var(--peace-border)] p-3 text-sm text-[var(--peace-ink)]">
          <input
            name="availabilityUnknown"
            type="checkbox"
            checked={availabilityUnknown}
            className="h-4 w-4"
            data-field="availabilityDays"
            onChange={(event) => {
              markPromptFieldTouched("availabilityDays");
              setAvailabilityUnknown(event.target.checked);
              if (event.target.checked) {
                setSelectedAttendanceSlots([]);
              }
            }}
          />
          <span>{copy.daysUnknown}</span>
        </label>
        {!availabilityUnknown && selectedAttendanceSlots.length === 0 ? (
          shouldShowPrompt("availabilityDays") ? (
            <p className="text-xs text-[#8a3323]">
              {copy.requiredDays}
            </p>
          ) : null
        ) : null}
      </section>

      <section className="rounded-lg border border-[var(--peace-border)] bg-white p-5">
        <h2 className="text-lg font-semibold">{copy.privacyTitle}</h2>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-[var(--peace-muted)]">
          {copy.privacyBody}
        </p>
        <label className="mt-4 flex items-start gap-3 text-sm text-[var(--peace-ink)]">
          <input
            name="privacyAccepted"
            type="checkbox"
            required
            className="mt-1 h-4 w-4"
            data-field="consents"
          />
          <span>
            {copy.privacyConsent}<RequiredIndicator />
          </span>
        </label>
        {hasAccessibilityNeeds === "yes" ? (
          <label className="mt-3 flex items-start gap-3 text-sm text-[var(--peace-ink)]">
            <input
              name="dataProcessingAccepted"
              type="checkbox"
              required
              className="mt-1 h-4 w-4"
              data-field="consents"
            />
            <span>
              {copy.sensitiveConsent}<RequiredIndicator />
            </span>
          </label>
        ) : null}
        <label className="mt-3 flex items-start gap-3 border-t border-[var(--peace-border)] pt-3 text-sm text-[var(--peace-ink)]">
          <input
            name="futureEventsCommunicationsAccepted"
            type="checkbox"
            className="mt-1 h-4 w-4"
          />
          <span>{copy.futureEventsConsent}</span>
        </label>
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className="min-h-12 rounded-md bg-[var(--peace-blue-800)] px-6 font-semibold text-white transition hover:bg-[var(--peace-blue-900)] disabled:cursor-not-allowed disabled:bg-[#8aa6bd]"
        >
          {isSubmitting ? copy.submitting : copy.submit}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
  className = "",
  required = false,
}: {
  required?: boolean;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`grid gap-2 text-sm font-medium text-[var(--peace-ink)] ${className}`}>
      <span>{label}{required ? <RequiredIndicator /> : null}</span>
      {children}
    </label>
  );
}

function AttendanceSlotTable({
  columns,
  disabled,
  selectedSlots,
  locale,
  onToggle,
}: {
  columns: ReturnType<typeof buildAttendanceDayColumns>;
  disabled: boolean;
  selectedSlots: string[];
  locale: SupportedLocale;
  onToggle: (slotValue: string, checked: boolean) => void;
}) {
  const selected = new Set(selectedSlots);

  if (columns.length === 0) {
    return null;
  }

  const gridTemplateColumns = `minmax(7rem, 0.7fr) repeat(${columns.length}, minmax(5.5rem, 1fr))`;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:hidden">
        {columns.map((column) => (
          <div
            key={column.day}
            className="overflow-hidden rounded-lg border border-[var(--peace-border)]"
          >
            <div className="bg-[#f7fbfe] px-2 py-3 text-center text-sm font-semibold text-[var(--peace-ink)]">
              {column.label}
            </div>
            {ATTENDANCE_PARTS.map((part) => {
              const slotAvailable = column.parts.includes(part.value);
              const slotValue = encodeAttendanceSlot({
                day: column.day,
                part: part.value as AttendancePart,
              });
              const partLabel = part.label[locale] ?? part.label.en;

              return (
                <label
                  key={`${column.day}-${part.value}`}
                  className={`flex min-h-12 items-center justify-between gap-2 border-t border-[var(--peace-border)] px-2 py-2 text-xs ${
                    slotAvailable
                      ? disabled
                        ? "bg-[#eef5fa] text-[#718196]"
                        : "bg-white text-[var(--peace-ink)]"
                      : "bg-[#f3f6f9] text-[#9aa8b8]"
                  }`}
                >
                  <span className="font-medium">{partLabel}</span>
                  {slotAvailable ? (
                    <input
                      name="availabilitySlots"
                      type="checkbox"
                      value={slotValue}
                      checked={selected.has(slotValue)}
                      disabled={disabled}
                      className="h-5 w-5 accent-[var(--peace-blue-800)]"
                      data-field="availabilityDays"
                      aria-label={`${partLabel} ${column.label}`}
                      onChange={(event) => onToggle(slotValue, event.target.checked)}
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

      <div className="hidden overflow-hidden rounded-lg border border-[var(--peace-border)] sm:block">
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
              const partLabel = part.label[locale] ?? part.label.en;

              return (
                <label
                  key={`${column.day}-${part.value}`}
                  className={`flex min-h-14 items-center justify-center border-r border-[var(--peace-border)] px-3 py-2 last:border-r-0 ${
                    slotAvailable
                      ? disabled
                        ? "bg-[#eef5fa] text-[#718196]"
                        : "bg-white text-[var(--peace-ink)]"
                      : "bg-[#f3f6f9] text-[#9aa8b8]"
                  }`}
                >
                  {slotAvailable ? (
                    <input
                      type="checkbox"
                      value={slotValue}
                      checked={selected.has(slotValue)}
                      disabled={disabled}
                      className="h-4 w-4 accent-[var(--peace-blue-800)]"
                      data-field="availabilityDays"
                      aria-label={`${partLabel} ${column.label}`}
                      onChange={(event) => onToggle(slotValue, event.target.checked)}
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
    </>
  );
}

function ChoiceButton({
  active,
  label,
  dataField,
  onClick,
}: {
  active: boolean;
  label: string;
  dataField?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      data-field={dataField}
      className={`min-h-12 rounded-md border px-4 text-sm font-semibold transition ${
        active
          ? "border-[var(--peace-blue-800)] bg-[var(--peace-blue-800)] text-white"
          : "border-[var(--peace-border-strong)] bg-white text-[var(--peace-ink)] hover:bg-[var(--peace-sky-100)]"
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function storageKey(email: string): string {
  return `${FORM_STORAGE_PREFIX}:${email.trim().toLowerCase()}`;
}

function readStoredForm(email: string): StoredRegistrationForm | null {
  try {
    migratePublicRegistrationDrafts(window.sessionStorage);
    const raw = window.sessionStorage.getItem(storageKey(email));

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as StoredRegistrationForm;

    if (parsed.email !== email || Date.now() - parsed.savedAt > 24 * 60 * 60 * 1000) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeStoredForm(
  email: string,
  form: HTMLFormElement,
  state: StoredRegistrationForm["state"]
) {
  if (!email) {
    return;
  }

  const formData = new FormData(form);
  const fields: Record<string, string[]> = {};

  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") {
      continue;
    }

    fields[key] = [...(fields[key] ?? []), value];
  }

  const stored: StoredRegistrationForm = {
    email,
    savedAt: Date.now(),
    fields,
    state,
  };

  try {
    window.sessionStorage.setItem(storageKey(email), JSON.stringify(stored));
  } catch {
    // Losing a draft is acceptable; form submission must keep working.
  }
}

function restoreNativeFields(
  form: HTMLFormElement | null,
  stored: StoredRegistrationForm
) {
  if (!form) {
    return;
  }

  for (const element of Array.from(form.elements)) {
    if (
      !(element instanceof HTMLInputElement) &&
      !(element instanceof HTMLTextAreaElement) &&
      !(element instanceof HTMLSelectElement)
    ) {
      continue;
    }

    if (!element.name || element.type === "hidden") {
      continue;
    }

    const values = stored.fields[element.name] ?? [];

    if (element instanceof HTMLInputElement && element.type === "checkbox") {
      const checkboxValue = element.value || "on";
      element.checked = values.includes(checkboxValue);
      continue;
    }

    if (element instanceof HTMLInputElement && element.type === "radio") {
      element.checked = values.includes(element.value);
      continue;
    }

    element.value = values[0] ?? element.value;
  }
}

function focusClientSideMissingField(
  form: HTMLFormElement | null,
  state: {
    hasAccessibilityNeeds: string;
    hasPreviousParticipation: string;
    participatesWithGroup: string;
    availabilityUnknown: boolean;
    selectedAttendanceSlots: string[];
    needsGroupChoice: boolean;
  }
) {
  if (!state.hasAccessibilityNeeds) {
    focusField(form, "hasAccessibilityNeeds");
    return;
  }

  if (!state.hasPreviousParticipation) {
    focusField(form, "hasPreviousSantegidioParticipation");
    return;
  }

  if (!state.participatesWithGroup) {
    focusField(form, "participatesWithGroup");
    return;
  }

  if (state.needsGroupChoice) {
    focusField(form, "group");
    return;
  }

  if (!state.availabilityUnknown && state.selectedAttendanceSlots.length === 0) {
    focusField(form, "availabilityDays");
  }
}

function focusFieldForError(form: HTMLFormElement | null, error: string) {
  const normalized = normalizeSearchText(error);

  if (normalized.includes("email")) {
    focusField(form, "email");
  } else if (normalized.includes("nome")) {
    focusField(form, "firstName");
  } else if (normalized.includes("cognome")) {
    focusField(form, "lastName");
  } else if (normalized.includes("data di nascita")) {
    focusField(form, "birthDate");
  } else if (normalized.includes("luogo di nascita")) {
    focusField(form, "birthPlace");
  } else if (normalized.includes("nazionalita")) {
    focusField(form, "nationality");
  } else if (normalized.includes("paese")) {
    focusField(form, "country");
  } else if (normalized.includes("citta")) {
    focusField(form, "city");
  } else if (normalized.includes("telefono") || normalized.includes("numero")) {
    focusField(form, "phone");
  } else if (normalized.includes("accessibilita")) {
    focusField(form, "hasAccessibilityNeeds");
  } else if (normalized.includes("bisogno") || normalized.includes("difficolta")) {
    focusField(form, "accessibilityAnswers");
  } else if (normalized.includes("sant'egidio")) {
    focusField(form, "hasPreviousSantegidioParticipation");
  } else if (normalized.includes("gruppo") || normalized.includes("referente")) {
    focusField(form, "group");
  } else if (normalized.includes("giorno") || normalized.includes("presenza")) {
    focusField(form, "availabilityDays");
  } else if (normalized.includes("privacy") || normalized.includes("trattamento")) {
    focusField(form, "consents");
  }
}

function focusField(form: HTMLFormElement | null, field: string) {
  const element = form?.querySelector<HTMLElement>(`[data-field="${field}"]`);

  if (!element) {
    return;
  }

  element.focus({ preventScroll: true });
  element.scrollIntoView({ block: "center", behavior: "smooth" });
}

function findCityId(
  cities: PublicRegistrationOptions["cities"],
  countryId: string,
  value: string
): string | null {
  const normalized = normalizeMatchText(value);

  if (!normalized) {
    return null;
  }

  return (
    cities.find(
      (city) =>
        city.country_id === countryId && normalizeMatchText(city.name) === normalized
    )?.id ?? null
  );
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
