"use client";

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
import {
  LANGUAGE_OPTIONS,
  type SupportedLocale,
} from "@/lib/i18n/config";

type RegistrationFormProps = {
  email: string;
  error?: string;
  groupRegistrationLinkToken: string | null;
  locale: SupportedLocale;
  options: PublicRegistrationOptions;
};

const OTHER_COUNTRY = "Altro / non in lista";
const OTHER_CITY = "Altro / non in lista";
const OTHER_PHONE_PREFIX = "other";
const FORM_STORAGE_PREFIX = "iscrizioni-pace.registration-form";
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const PHONE_PREFIX_OPTIONS = [
  { value: "+39", label: "Italia +39" },
  { value: "+33", label: "Francia +33" },
  { value: "+49", label: "Germania +49" },
  { value: "+34", label: "Spagna +34" },
  { value: "+351", label: "Portogallo +351" },
  { value: "+44", label: "Regno Unito +44" },
  { value: "+353", label: "Irlanda +353" },
  { value: "+41", label: "Svizzera +41" },
  { value: "+43", label: "Austria +43" },
  { value: "+32", label: "Belgio +32" },
  { value: "+31", label: "Paesi Bassi +31" },
  { value: "+45", label: "Danimarca +45" },
  { value: "+46", label: "Svezia +46" },
  { value: "+47", label: "Norvegia +47" },
  { value: "+358", label: "Finlandia +358" },
  { value: "+48", label: "Polonia +48" },
  { value: "+420", label: "Cechia +420" },
  { value: "+421", label: "Slovacchia +421" },
  { value: "+36", label: "Ungheria +36" },
  { value: "+386", label: "Slovenia +386" },
  { value: "+385", label: "Croazia +385" },
  { value: "+30", label: "Grecia +30" },
  { value: "+40", label: "Romania +40" },
  { value: "+359", label: "Bulgaria +359" },
  { value: "+380", label: "Ucraina +380" },
  { value: "+1", label: "Stati Uniti / Canada +1" },
  { value: "+55", label: "Brasile +55" },
  { value: "+54", label: "Argentina +54" },
  { value: "+52", label: "Messico +52" },
  { value: "+91", label: "India +91" },
  { value: "+86", label: "Cina +86" },
  { value: "+81", label: "Giappone +81" },
  { value: "+61", label: "Australia +61" },
  { value: "+212", label: "Marocco +212" },
  { value: "+216", label: "Tunisia +216" },
  { value: "+20", label: "Egitto +20" },
] as const;

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
    selectedEventDays: string[];
  availabilityUnknown: boolean;
  };
};

type RegistrationFormCopy = {
  newRegistration: string;
  intro: string;
  groupLinkPrefix: string;
  groupLinkSuffix: string;
  groupLinkHelp: string;
  genericRegistration: string;
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
  preferredLanguage: string;
  accessibilityQuestion: string;
  accessibilityTitle: string;
  accessibilityHelp: string;
  accessibilityNotes: string;
  previousQuestion: string;
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
    newRegistration: "Nuova iscrizione",
    intro:
      "Questa è la prima iscrizione all'evento. Dopo l'invio potrai accedere alla tua dashboard, scaricare il QR code per l'ingresso e, quando sarà pubblicato il programma completo, scegliere i momenti a cui partecipare, come panel tematici ed eventi.",
    groupLinkPrefix: "Questo link iscrive al gruppo",
    groupLinkSuffix: ".",
    groupLinkHelp:
      "Se non pensi che questo sia il tuo gruppo, usa l'iscrizione generica per scegliere il gruppo o il referente corretto.",
    genericRegistration: "Vai all'iscrizione generica",
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
    preferredLanguage: "Lingua preferita",
    accessibilityQuestion:
      "Hai una disabilità, una condizione di salute o un bisogno di accessibilità che desideri segnalarci per organizzare meglio l'accoglienza?",
    accessibilityTitle: "Quali aspetti dobbiamo considerare?",
    accessibilityHelp:
      "Puoi selezionare una o più opzioni utili per organizzare meglio l'accoglienza.",
    accessibilityNotes: "Ci sono indicazioni pratiche che vuoi comunicarci? (opzionale)",
    previousQuestion:
      "Hai mai partecipato ad altri eventi o attività della Comunità di Sant'Egidio nella tua città?",
    groupQuestion:
      "Fai parte di un gruppo o una assemblea della Comunità di Sant'Egidio?",
    groupLabel: "Gruppo o referente",
    groupPlaceholder: "Cerca per gruppo o referente",
    groupDisabledPlaceholder: "Indica prima paese, città e data di nascita",
    noMatchingLeader: "Nessun referente affine trovato",
    cannotFindLeader: "Non trovo il mio referente",
    daysTitle: "In quali giorni pensi di essere presente?",
    daysHelp:
      "Puoi selezionare uno o più giorni dell'evento, oppure indicare che lo comunicherai più avanti.",
    daysUnknown: "Non lo so ancora, lo comunicherò in seguito",
    privacyTitle: "Privacy e trattamento dati",
    privacyBody:
      "Confermo di aver letto l'informativa privacy dell'evento e autorizzo il trattamento dei dati inseriti per gestire l'iscrizione, l'identificazione del partecipante, le comunicazioni organizzative, l'accoglienza, gli eventuali bisogni di accessibilità e gli adempimenti di sicurezza e legge collegati all'evento. I dati saranno trattati secondo il Regolamento UE 2016/679 (GDPR), con misure adeguate di riservatezza, accesso limitato ai soli incaricati e conservazione per il tempo necessario alle finalità indicate. So che posso esercitare i diritti di accesso, rettifica, cancellazione, limitazione, opposizione e revoca del consenso, senza pregiudicare la liceità del trattamento già effettuato.",
    privacyConsent:
      "Accetto l'informativa privacy e autorizzo il trattamento dei dati necessari alla gestione dell'iscrizione e dell'evento.",
    sensitiveConsent:
      "Acconsento al trattamento delle informazioni su disabilità, salute o bisogni di accessibilità indicate, per predisporre misure di accoglienza e supporto durante l'evento.",
    requiredChoice: "Seleziona una risposta per proseguire.",
    requiredGroup: "Seleziona un referente o indica che non lo trovi.",
    requiredDays: "Seleziona almeno un giorno o indica che lo comunicherai in seguito.",
    yes: "Sì",
    no: "No",
    submit: "Invia iscrizione",
    submitting: "Invio iscrizione...",
  },
  en: {
    newRegistration: "New registration",
    intro:
      "This is your first registration for the event. After submitting it, you will be able to access your dashboard, download the QR code for entry and, when the full programme is published, choose the moments you want to attend, such as thematic panels and events.",
    groupLinkPrefix: "This link registers you with the group",
    groupLinkSuffix: ".",
    groupLinkHelp:
      "If you do not think this is your group, use the general registration to choose the correct group or contact person.",
    genericRegistration: "Go to general registration",
    firstName: "First name",
    lastName: "Last name",
    country: "Country where you usually live",
    countryPlaceholder: "Search for the country where you live",
    countryOtherPlaceholder: "Write the country where you live",
    noCountry: "No country found",
    city: "City where you usually live",
    cityPlaceholder: "Search for the city where you live",
    cityDisabledPlaceholder: "Select the country first",
    cityOtherPlaceholder: "Write the city where you live",
    noCity: "No city found",
    birthDate: "Date of birth",
    birthPlace: "Place of birth (country and city)",
    birthPlacePlaceholder: "For example: Italy, Rome",
    nationality: "Nationality",
    nationalityPlaceholder: "Search nationality",
    noNationality: "No nationality found",
    phone: "Phone (optional)",
    phonePrefixLabel: "International prefix",
    phoneOther: "Other",
    phoneNumberPlaceholder: "Number",
    phonePrefixPlaceholder: "Write the prefix, for example +234",
    phoneTitle: "Use only digits, spaces, dots, brackets or hyphens.",
    preferredLanguage: "Preferred language",
    accessibilityQuestion:
      "Do you have a disability, health condition or accessibility need that you would like to tell us about so we can organise the welcome better?",
    accessibilityTitle: "Which aspects should we consider?",
    accessibilityHelp:
      "You can select one or more options that are useful for organising the welcome better.",
    accessibilityNotes: "Are there any practical notes you would like to share? (optional)",
    previousQuestion:
      "Have you ever taken part in other Sant'Egidio events or activities in your city?",
    groupQuestion: "Are you part of a Sant'Egidio group or assembly?",
    groupLabel: "Group or contact person",
    groupPlaceholder: "Search by group or contact person",
    groupDisabledPlaceholder: "Enter country, city and date of birth first",
    noMatchingLeader: "No matching contact person found",
    cannotFindLeader: "I cannot find my contact person",
    daysTitle: "Which days do you think you will attend?",
    daysHelp:
      "You can select one or more event days, or say that you will communicate this later.",
    daysUnknown: "I do not know yet; I will communicate it later",
    privacyTitle: "Privacy and data processing",
    privacyBody:
      "I confirm that I have read the event privacy notice and authorise the processing of the data entered to manage the registration, identify the participant, send organisational communications, organise welcome arrangements, handle any accessibility needs and fulfil safety and legal requirements connected with the event. The data will be processed under EU Regulation 2016/679 (GDPR), with appropriate confidentiality measures, access limited to authorised staff and storage only for the time needed for the stated purposes. I know that I may exercise the rights of access, rectification, erasure, restriction, objection and withdrawal of consent, without affecting the lawfulness of processing already carried out.",
    privacyConsent:
      "I accept the privacy notice and authorise the processing of the data needed to manage the registration and the event.",
    sensitiveConsent:
      "I consent to the processing of the information provided about disability, health or accessibility needs, so that welcome and support measures can be prepared during the event.",
    requiredChoice: "Select an answer to continue.",
    requiredGroup: "Select a contact person or indicate that you cannot find one.",
    requiredDays: "Select at least one day or indicate that you will communicate it later.",
    yes: "Yes",
    no: "No",
    submit: "Submit registration",
    submitting: "Submitting registration...",
  },
  fr: {
    newRegistration: "Nouvelle inscription",
    intro:
      "Il s'agit de ta première inscription à l'événement. Après l'envoi, tu pourras accéder à ton dashboard, télécharger le QR code pour l'entrée et, lorsque le programme complet sera publié, choisir les moments auxquels participer, comme les panels thématiques et les événements.",
    groupLinkPrefix: "Ce lien t'inscrit au groupe",
    groupLinkSuffix: ".",
    groupLinkHelp:
      "Si tu ne penses pas que ce soit ton groupe, utilise l'inscription générale pour choisir le bon groupe ou le bon référent.",
    genericRegistration: "Aller à l'inscription générale",
    firstName: "Prénom",
    lastName: "Nom",
    country: "Pays où tu vis habituellement",
    countryPlaceholder: "Cherche le pays où tu vis",
    countryOtherPlaceholder: "Écris le pays où tu vis",
    noCountry: "Aucun pays trouvé",
    city: "Ville où tu vis habituellement",
    cityPlaceholder: "Cherche la ville où tu vis",
    cityDisabledPlaceholder: "Sélectionne d'abord le pays",
    cityOtherPlaceholder: "Écris la ville où tu vis",
    noCity: "Aucune ville trouvée",
    birthDate: "Date de naissance",
    birthPlace: "Lieu de naissance (pays et ville)",
    birthPlacePlaceholder: "Par exemple : Italie, Rome",
    nationality: "Nationalité",
    nationalityPlaceholder: "Cherche la nationalité",
    noNationality: "Aucune nationalité trouvée",
    phone: "Téléphone (optionnel)",
    phonePrefixLabel: "Préfixe international",
    phoneOther: "Autre",
    phoneNumberPlaceholder: "Numéro",
    phonePrefixPlaceholder: "Écris le préfixe, par exemple +234",
    phoneTitle: "Saisis uniquement des chiffres, espaces, points, parenthèses ou tirets.",
    preferredLanguage: "Langue préférée",
    accessibilityQuestion:
      "As-tu un handicap, un problème de santé ou un besoin d'accessibilité que tu souhaites nous signaler pour mieux organiser l'accueil ?",
    accessibilityTitle: "Quels aspects devons-nous prendre en compte ?",
    accessibilityHelp:
      "Tu peux sélectionner une ou plusieurs options utiles pour mieux organiser l'accueil.",
    accessibilityNotes: "Y a-t-il des indications pratiques que tu veux nous communiquer ? (optionnel)",
    previousQuestion:
      "As-tu déjà participé à d'autres événements ou activités de la Communauté de Sant'Egidio dans ta ville ?",
    groupQuestion: "Fais-tu partie d'un groupe ou d'une assemblée de Sant'Egidio ?",
    groupLabel: "Groupe ou référent",
    groupPlaceholder: "Chercher par groupe ou référent",
    groupDisabledPlaceholder: "Indique d'abord pays, ville et date de naissance",
    noMatchingLeader: "Aucun référent correspondant trouvé",
    cannotFindLeader: "Je ne trouve pas mon référent",
    daysTitle: "Quels jours penses-tu être présent ?",
    daysHelp:
      "Tu peux sélectionner un ou plusieurs jours de l'événement, ou indiquer que tu le communiqueras plus tard.",
    daysUnknown: "Je ne sais pas encore, je le communiquerai plus tard",
    privacyTitle: "Confidentialité et traitement des données",
    privacyBody:
      "Je confirme avoir lu la notice de confidentialité de l'événement et j'autorise le traitement des données saisies pour gérer l'inscription, identifier le participant, envoyer les communications d'organisation, organiser l'accueil, gérer les éventuels besoins d'accessibilité et remplir les obligations de sécurité et légales liées à l'événement. Les données seront traitées conformément au Règlement UE 2016/679 (RGPD), avec des mesures appropriées de confidentialité, un accès limité aux personnes autorisées et une conservation limitée au temps nécessaire aux finalités indiquées. Je sais que je peux exercer mes droits d'accès, rectification, effacement, limitation, opposition et retrait du consentement, sans affecter la licéité du traitement déjà effectué.",
    privacyConsent:
      "J'accepte la notice de confidentialité et j'autorise le traitement des données nécessaires à la gestion de l'inscription et de l'événement.",
    sensitiveConsent:
      "Je consens au traitement des informations indiquées concernant un handicap, la santé ou des besoins d'accessibilité, afin de préparer des mesures d'accueil et de support pendant l'événement.",
    requiredChoice: "Sélectionne une réponse pour continuer.",
    requiredGroup: "Sélectionne un référent ou indique que tu ne le trouves pas.",
    requiredDays: "Sélectionne au moins un jour ou indique que tu le communiqueras plus tard.",
    yes: "Oui",
    no: "Non",
    submit: "Envoyer l'inscription",
    submitting: "Envoi de l'inscription...",
  },
  de: {
    newRegistration: "Neue Anmeldung",
    intro:
      "Dies ist deine erste Anmeldung für die Veranstaltung. Nach dem Absenden kannst du dein Dashboard öffnen, den QR-Code für den Einlass herunterladen und, sobald das vollständige Programm veröffentlicht ist, die Programmpunkte auswählen, an denen du teilnehmen möchtest.",
    groupLinkPrefix: "Dieser Link meldet dich für die Gruppe an",
    groupLinkSuffix: ".",
    groupLinkHelp:
      "Wenn du denkst, dass dies nicht deine Gruppe ist, nutze die allgemeine Anmeldung, um die richtige Gruppe oder Kontaktperson auszuwählen.",
    genericRegistration: "Zur allgemeinen Anmeldung",
    firstName: "Vorname",
    lastName: "Nachname",
    country: "Land, in dem du normalerweise lebst",
    countryPlaceholder: "Suche das Land, in dem du lebst",
    countryOtherPlaceholder: "Schreibe das Land, in dem du lebst",
    noCountry: "Kein Land gefunden",
    city: "Stadt, in der du normalerweise lebst",
    cityPlaceholder: "Suche die Stadt, in der du lebst",
    cityDisabledPlaceholder: "Wähle zuerst das Land aus",
    cityOtherPlaceholder: "Schreibe die Stadt, in der du lebst",
    noCity: "Keine Stadt gefunden",
    birthDate: "Geburtsdatum",
    birthPlace: "Geburtsort (Land und Stadt)",
    birthPlacePlaceholder: "Zum Beispiel: Italien, Rom",
    nationality: "Staatsangehörigkeit",
    nationalityPlaceholder: "Staatsangehörigkeit suchen",
    noNationality: "Keine Staatsangehörigkeit gefunden",
    phone: "Telefon (optional)",
    phonePrefixLabel: "Internationale Vorwahl",
    phoneOther: "Andere",
    phoneNumberPlaceholder: "Nummer",
    phonePrefixPlaceholder: "Schreibe die Vorwahl, zum Beispiel +234",
    phoneTitle: "Gib nur Ziffern, Leerzeichen, Punkte, Klammern oder Bindestriche ein.",
    preferredLanguage: "Bevorzugte Sprache",
    accessibilityQuestion:
      "Hast du eine Behinderung, gesundheitliche Situation oder einen Barrierefreiheitsbedarf, den du uns mitteilen möchtest, damit wir den Empfang besser organisieren können?",
    accessibilityTitle: "Welche Aspekte sollen wir berücksichtigen?",
    accessibilityHelp:
      "Du kannst eine oder mehrere Optionen auswählen, die für die Organisation des Empfangs hilfreich sind.",
    accessibilityNotes: "Gibt es praktische Hinweise, die du uns mitteilen möchtest? (optional)",
    previousQuestion:
      "Hast du bereits an anderen Veranstaltungen oder Aktivitäten der Gemeinschaft Sant'Egidio in deiner Stadt teilgenommen?",
    groupQuestion: "Gehörst du zu einer Gruppe oder Versammlung von Sant'Egidio?",
    groupLabel: "Gruppe oder Kontaktperson",
    groupPlaceholder: "Nach Gruppe oder Kontaktperson suchen",
    groupDisabledPlaceholder: "Gib zuerst Land, Stadt und Geburtsdatum an",
    noMatchingLeader: "Keine passende Kontaktperson gefunden",
    cannotFindLeader: "Ich finde meine Kontaktperson nicht",
    daysTitle: "An welchen Tagen wirst du voraussichtlich anwesend sein?",
    daysHelp:
      "Du kannst einen oder mehrere Veranstaltungstage auswählen oder angeben, dass du es später mitteilst.",
    daysUnknown: "Ich weiß es noch nicht und teile es später mit",
    privacyTitle: "Datenschutz und Datenverarbeitung",
    privacyBody:
      "Ich bestätige, dass ich die Datenschutzhinweise zur Veranstaltung gelesen habe, und erlaube die Verarbeitung der eingegebenen Daten zur Verwaltung der Anmeldung, Identifizierung der teilnehmenden Person, organisatorischen Kommunikation, Organisation des Empfangs, Bearbeitung eventueller Barrierefreiheitsbedarfe sowie zur Erfüllung von Sicherheits- und Rechtspflichten im Zusammenhang mit der Veranstaltung. Die Daten werden gemäß EU-Verordnung 2016/679 (DSGVO) verarbeitet, mit angemessenen Vertraulichkeitsmaßnahmen, Zugriff nur für autorisierte Personen und Speicherung nur für die für die genannten Zwecke erforderliche Zeit. Ich weiß, dass ich meine Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch und Widerruf der Einwilligung ausüben kann, ohne die Rechtmäßigkeit der bereits erfolgten Verarbeitung zu berühren.",
    privacyConsent:
      "Ich akzeptiere die Datenschutzhinweise und erlaube die Verarbeitung der Daten, die für die Verwaltung der Anmeldung und der Veranstaltung erforderlich sind.",
    sensitiveConsent:
      "Ich stimme der Verarbeitung der angegebenen Informationen zu Behinderung, Gesundheit oder Barrierefreiheitsbedarf zu, damit Empfangs- und Unterstützungsmaßnahmen während der Veranstaltung vorbereitet werden können.",
    requiredChoice: "Wähle eine Antwort aus, um fortzufahren.",
    requiredGroup: "Wähle eine Kontaktperson aus oder gib an, dass du sie nicht findest.",
    requiredDays: "Wähle mindestens einen Tag aus oder gib an, dass du es später mitteilst.",
    yes: "Ja",
    no: "Nein",
    submit: "Anmeldung senden",
    submitting: "Anmeldung wird gesendet...",
  },
  es: {
    newRegistration: "Nueva inscripción",
    intro:
      "Esta es tu primera inscripción al evento. Después de enviarla podrás acceder a tu panel, descargar el código QR para la entrada y, cuando se publique el programa completo, elegir los momentos en los que participar, como paneles temáticos y eventos.",
    groupLinkPrefix: "Este enlace te inscribe en el grupo",
    groupLinkSuffix: ".",
    groupLinkHelp:
      "Si no crees que este sea tu grupo, usa la inscripción general para elegir el grupo o referente correcto.",
    genericRegistration: "Ir a la inscripción general",
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
    nationalityPlaceholder: "Busca la nacionalidad",
    noNationality: "No se encontró ninguna nacionalidad",
    phone: "Teléfono (opcional)",
    phonePrefixLabel: "Prefijo internacional",
    phoneOther: "Otro",
    phoneNumberPlaceholder: "Número",
    phonePrefixPlaceholder: "Escribe el prefijo, por ejemplo +234",
    phoneTitle: "Introduce solo cifras, espacios, puntos, paréntesis o guiones.",
    preferredLanguage: "Idioma preferido",
    accessibilityQuestion:
      "¿Tienes una discapacidad, condición de salud o necesidad de accesibilidad que quieras comunicarnos para organizar mejor la acogida?",
    accessibilityTitle: "¿Qué aspectos debemos tener en cuenta?",
    accessibilityHelp:
      "Puedes seleccionar una o más opciones útiles para organizar mejor la acogida.",
    accessibilityNotes: "¿Hay indicaciones prácticas que quieras comunicarnos? (opcional)",
    previousQuestion:
      "¿Has participado alguna vez en otros eventos o actividades de la Comunidad de Sant'Egidio en tu ciudad?",
    groupQuestion: "¿Formas parte de un grupo o asamblea de Sant'Egidio?",
    groupLabel: "Grupo o referente",
    groupPlaceholder: "Buscar por grupo o referente",
    groupDisabledPlaceholder: "Indica primero país, ciudad y fecha de nacimiento",
    noMatchingLeader: "No se encontró ningún referente compatible",
    cannotFindLeader: "No encuentro a mi referente",
    daysTitle: "¿Qué días crees que estarás presente?",
    daysHelp:
      "Puedes seleccionar uno o más días del evento, o indicar que lo comunicarás más adelante.",
    daysUnknown: "Todavía no lo sé; lo comunicaré más adelante",
    privacyTitle: "Privacidad y tratamiento de datos",
    privacyBody:
      "Confirmo que he leído la información de privacidad del evento y autorizo el tratamiento de los datos introducidos para gestionar la inscripción, identificar al participante, enviar comunicaciones organizativas, organizar la acogida, gestionar posibles necesidades de accesibilidad y cumplir obligaciones de seguridad y legales relacionadas con el evento. Los datos se tratarán conforme al Reglamento UE 2016/679 (RGPD), con medidas adecuadas de confidencialidad, acceso limitado al personal autorizado y conservación solo durante el tiempo necesario para las finalidades indicadas. Sé que puedo ejercer los derechos de acceso, rectificación, supresión, limitación, oposición y retirada del consentimiento, sin afectar a la licitud del tratamiento ya realizado.",
    privacyConsent:
      "Acepto la información de privacidad y autorizo el tratamiento de los datos necesarios para gestionar la inscripción y el evento.",
    sensitiveConsent:
      "Consiento el tratamiento de la información indicada sobre discapacidad, salud o necesidades de accesibilidad para preparar medidas de acogida y apoyo durante el evento.",
    requiredChoice: "Selecciona una respuesta para continuar.",
    requiredGroup: "Selecciona un referente o indica que no lo encuentras.",
    requiredDays: "Selecciona al menos un día o indica que lo comunicarás más adelante.",
    yes: "Sí",
    no: "No",
    submit: "Enviar inscripción",
    submitting: "Enviando inscripción...",
  },
  nl: {
    newRegistration: "Nieuwe inschrijving",
    intro:
      "Dit is je eerste inschrijving voor het evenement. Na verzending kun je je dashboard openen, de QR-code voor de toegang downloaden en, zodra het volledige programma is gepubliceerd, de momenten kiezen waaraan je wilt deelnemen.",
    groupLinkPrefix: "Deze link schrijft je in bij de groep",
    groupLinkSuffix: ".",
    groupLinkHelp:
      "Als je denkt dat dit niet je groep is, gebruik dan de algemene inschrijving om de juiste groep of contactpersoon te kiezen.",
    genericRegistration: "Ga naar algemene inschrijving",
    firstName: "Voornaam",
    lastName: "Achternaam",
    country: "Land waar je gewoonlijk woont",
    countryPlaceholder: "Zoek het land waar je woont",
    countryOtherPlaceholder: "Schrijf het land waar je woont",
    noCountry: "Geen land gevonden",
    city: "Stad waar je gewoonlijk woont",
    cityPlaceholder: "Zoek de stad waar je woont",
    cityDisabledPlaceholder: "Selecteer eerst het land",
    cityOtherPlaceholder: "Schrijf de stad waar je woont",
    noCity: "Geen stad gevonden",
    birthDate: "Geboortedatum",
    birthPlace: "Geboorteplaats (land en stad)",
    birthPlacePlaceholder: "Bijvoorbeeld: Italië, Rome",
    nationality: "Nationaliteit",
    nationalityPlaceholder: "Zoek nationaliteit",
    noNationality: "Geen nationaliteit gevonden",
    phone: "Telefoon (optioneel)",
    phonePrefixLabel: "Internationaal kengetal",
    phoneOther: "Anders",
    phoneNumberPlaceholder: "Nummer",
    phonePrefixPlaceholder: "Schrijf het kengetal, bijvoorbeeld +234",
    phoneTitle: "Gebruik alleen cijfers, spaties, punten, haakjes of streepjes.",
    preferredLanguage: "Voorkeurstaal",
    accessibilityQuestion:
      "Heb je een handicap, gezondheidssituatie of toegankelijkheidsbehoefte die je ons wilt melden zodat we de ontvangst beter kunnen organiseren?",
    accessibilityTitle: "Waar moeten we rekening mee houden?",
    accessibilityHelp:
      "Je kunt een of meer opties selecteren die nuttig zijn om de ontvangst beter te organiseren.",
    accessibilityNotes: "Zijn er praktische aanwijzingen die je wilt delen? (optioneel)",
    previousQuestion:
      "Heb je eerder deelgenomen aan andere evenementen of activiteiten van de Gemeenschap van Sant'Egidio in je stad?",
    groupQuestion: "Maak je deel uit van een groep of vergadering van Sant'Egidio?",
    groupLabel: "Groep of contactpersoon",
    groupPlaceholder: "Zoek op groep of contactpersoon",
    groupDisabledPlaceholder: "Vul eerst land, stad en geboortedatum in",
    noMatchingLeader: "Geen passende contactpersoon gevonden",
    cannotFindLeader: "Ik kan mijn contactpersoon niet vinden",
    daysTitle: "Op welke dagen denk je aanwezig te zijn?",
    daysHelp:
      "Je kunt een of meer dagen van het evenement selecteren, of aangeven dat je dit later doorgeeft.",
    daysUnknown: "Ik weet het nog niet; ik geef het later door",
    privacyTitle: "Privacy en gegevensverwerking",
    privacyBody:
      "Ik bevestig dat ik de privacyverklaring van het evenement heb gelezen en geef toestemming voor de verwerking van de ingevoerde gegevens om de inschrijving te beheren, de deelnemer te identificeren, organisatorische communicatie te verzenden, de ontvangst te organiseren, eventuele toegankelijkheidsbehoeften te beheren en te voldoen aan veiligheids- en wettelijke verplichtingen rond het evenement. De gegevens worden verwerkt volgens EU-verordening 2016/679 (AVG), met passende vertrouwelijkheidsmaatregelen, toegang beperkt tot bevoegde medewerkers en bewaring alleen zolang nodig voor de genoemde doeleinden. Ik weet dat ik mijn rechten op toegang, rectificatie, verwijdering, beperking, bezwaar en intrekking van toestemming kan uitoefenen, zonder afbreuk te doen aan de rechtmatigheid van reeds uitgevoerde verwerking.",
    privacyConsent:
      "Ik accepteer de privacyverklaring en geef toestemming voor de verwerking van de gegevens die nodig zijn om de inschrijving en het evenement te beheren.",
    sensitiveConsent:
      "Ik stem in met de verwerking van de verstrekte informatie over handicap, gezondheid of toegankelijkheidsbehoeften, zodat ontvangst- en ondersteuningsmaatregelen tijdens het evenement kunnen worden voorbereid.",
    requiredChoice: "Selecteer een antwoord om door te gaan.",
    requiredGroup: "Selecteer een contactpersoon of geef aan dat je die niet kunt vinden.",
    requiredDays: "Selecteer ten minste één dag of geef aan dat je dit later doorgeeft.",
    yes: "Ja",
    no: "Nee",
    submit: "Inschrijving verzenden",
    submitting: "Inschrijving wordt verzonden...",
  },
  uk: {
    newRegistration: "Нова реєстрація",
    intro:
      "Це ваша перша реєстрація на подію. Після надсилання ви зможете відкрити свою панель, завантажити QR-код для входу і, коли буде опублікована повна програма, вибрати частини програми, у яких хочете взяти участь.",
    groupLinkPrefix: "Це посилання реєструє вас у групі",
    groupLinkSuffix: ".",
    groupLinkHelp:
      "Якщо ви вважаєте, що це не ваша група, скористайтеся загальною реєстрацією, щоб вибрати правильну групу або контактну особу.",
    genericRegistration: "Перейти до загальної реєстрації",
    firstName: "Ім'я",
    lastName: "Прізвище",
    country: "Країна, де ви зазвичай живете",
    countryPlaceholder: "Знайдіть країну, де ви живете",
    countryOtherPlaceholder: "Напишіть країну, де ви живете",
    noCountry: "Країну не знайдено",
    city: "Місто, де ви зазвичай живете",
    cityPlaceholder: "Знайдіть місто, де ви живете",
    cityDisabledPlaceholder: "Спочатку виберіть країну",
    cityOtherPlaceholder: "Напишіть місто, де ви живете",
    noCity: "Місто не знайдено",
    birthDate: "Дата народження",
    birthPlace: "Місце народження (країна і місто)",
    birthPlacePlaceholder: "Наприклад: Італія, Рим",
    nationality: "Громадянство",
    nationalityPlaceholder: "Знайти громадянство",
    noNationality: "Громадянство не знайдено",
    phone: "Телефон (необов'язково)",
    phonePrefixLabel: "Міжнародний код",
    phoneOther: "Інше",
    phoneNumberPlaceholder: "Номер",
    phonePrefixPlaceholder: "Напишіть код, наприклад +234",
    phoneTitle: "Вводьте лише цифри, пробіли, крапки, дужки або дефіси.",
    preferredLanguage: "Бажана мова",
    accessibilityQuestion:
      "Чи маєте ви інвалідність, стан здоров'я або потребу в доступності, про які хочете повідомити нам, щоб ми краще організували прийом?",
    accessibilityTitle: "Що нам потрібно врахувати?",
    accessibilityHelp:
      "Можна вибрати один або кілька варіантів, корисних для кращої організації прийому.",
    accessibilityNotes: "Чи є практичні вказівки, які ви хочете нам повідомити? (необов'язково)",
    previousQuestion:
      "Чи брали ви раніше участь в інших подіях або діяльності Спільноти Sant'Egidio у вашому місті?",
    groupQuestion: "Ви належите до групи або зібрання Sant'Egidio?",
    groupLabel: "Група або контактна особа",
    groupPlaceholder: "Шукати за групою або контактною особою",
    groupDisabledPlaceholder: "Спочатку вкажіть країну, місто і дату народження",
    noMatchingLeader: "Відповідну контактну особу не знайдено",
    cannotFindLeader: "Я не можу знайти свою контактну особу",
    daysTitle: "У які дні ви плануєте бути присутніми?",
    daysHelp:
      "Можна вибрати один або кілька днів події або вказати, що повідомите це пізніше.",
    daysUnknown: "Я ще не знаю, повідомлю пізніше",
    privacyTitle: "Конфіденційність і обробка даних",
    privacyBody:
      "Я підтверджую, що прочитав/прочитала повідомлення про конфіденційність події, і дозволяю обробку введених даних для управління реєстрацією, ідентифікації учасника, організаційних повідомлень, організації прийому, можливих потреб доступності та виконання вимог безпеки і закону, пов'язаних із подією. Дані оброблятимуться відповідно до Регламенту ЄС 2016/679 (GDPR), із належними заходами конфіденційності, доступом лише для уповноважених осіб і зберіганням лише протягом часу, необхідного для зазначених цілей. Я знаю, що можу здійснювати права доступу, виправлення, видалення, обмеження, заперечення та відкликання згоди, без шкоди для законності вже здійсненої обробки.",
    privacyConsent:
      "Я приймаю повідомлення про конфіденційність і дозволяю обробку даних, необхідних для управління реєстрацією та подією.",
    sensitiveConsent:
      "Я погоджуюся на обробку вказаної інформації про інвалідність, здоров'я або потреби доступності, щоб підготувати заходи прийому та підтримки під час події.",
    requiredChoice: "Виберіть відповідь, щоб продовжити.",
    requiredGroup: "Виберіть контактну особу або вкажіть, що не можете її знайти.",
    requiredDays: "Виберіть принаймні один день або вкажіть, що повідомите пізніше.",
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
  locale,
  options,
}: RegistrationFormProps) {
  const copy = REGISTRATION_FORM_COPY[locale] ?? REGISTRATION_FORM_COPY.en;
  const formRef = useRef<HTMLFormElement>(null);
  const submittedRef = useRef(false);
  const [hasAccessibilityNeeds, setHasAccessibilityNeeds] = useState("");
  const [hasPreviousParticipation, setHasPreviousParticipation] = useState(
    options.groupLink ? "yes" : ""
  );
  const [participatesWithGroup, setParticipatesWithGroup] = useState(
    options.groupLink ? "yes" : ""
  );
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
  const [selectedEventDays, setSelectedEventDays] = useState<string[]>([]);
  const [availabilityUnknown, setAvailabilityUnknown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(Boolean(error));
  const [touchedPromptFields, setTouchedPromptFields] = useState<
    Partial<Record<PromptField, boolean>>
  >({});

  const eventDays = buildEventDays(
    options.event?.starts_on ?? null,
    options.event?.ends_on ?? null,
    locale
  );
  const filteredCountries = EUROPEAN_COUNTRIES.filter((country) =>
    normalizeSearchText(country).includes(normalizeSearchText(countrySearch))
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
      selectedEventDays,
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
    selectedEventDays,
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
        options.groupLink ? "yes" : stored.state.hasPreviousParticipation
      );
      setParticipatesWithGroup(
        options.groupLink ? "yes" : stored.state.participatesWithGroup
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
      setSelectedEventDays(stored.state.selectedEventDays);
      setAvailabilityUnknown(stored.state.availabilityUnknown);

      window.setTimeout(() => {
        restoreNativeFields(formRef.current, stored);
        focusFieldForError(formRef.current, error);
      }, 0);
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, [email, error, options.groupLink]);

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

        saveCurrentForm();
        const effectiveHasPreviousParticipation = hasGroupLink
          ? "yes"
          : hasPreviousParticipation;
        const effectiveParticipatesWithGroup = hasGroupLink
          ? "yes"
          : participatesWithGroup;

        if (
          !hasAccessibilityNeeds ||
          !effectiveHasPreviousParticipation ||
          (effectiveHasPreviousParticipation === "yes" &&
            !effectiveParticipatesWithGroup) ||
          (effectiveHasPreviousParticipation === "yes" &&
            effectiveParticipatesWithGroup === "yes" &&
            !cannotFindLeader &&
            !selectedGroupValue) ||
          (!availabilityUnknown && selectedEventDays.length === 0)
        ) {
          event.preventDefault();
          setHasAttemptedSubmit(true);
          focusClientSideMissingField(formRef.current, {
            hasAccessibilityNeeds,
            hasPreviousParticipation: effectiveHasPreviousParticipation,
            participatesWithGroup: effectiveParticipatesWithGroup,
            availabilityUnknown,
            selectedEventDays,
            needsGroupChoice:
              effectiveHasPreviousParticipation === "yes" &&
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
      {options.groupLink ? (
        <>
          <input
            name="hasPreviousSantegidioParticipation"
            type="hidden"
            value="yes"
          />
          <input name="participatesWithGroup" type="hidden" value="yes" />
          <input name="groupId" type="hidden" value={options.groupLink.groupId} />
        </>
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
                  {options.groupLink.displayLabel}
                </span>
                {copy.groupLinkSuffix}
              </p>
              <p className="mt-2 leading-6 text-[var(--peace-muted)]">
                {copy.groupLinkHelp}
              </p>
              <a
                href="/registrazione"
                className="btn-secondary mt-3 inline-flex min-h-9 items-center px-3 text-sm"
              >
                {copy.genericRegistration}
              </a>
            </div>
          ) : null}
        </div>
      </header>

      <section className="grid gap-4 rounded-lg border border-[var(--peace-border)] bg-white p-5 sm:grid-cols-2">
        <Field label="Email" className="sm:col-span-2">
          <input
            name="email"
            type="email"
            required
            defaultValue={email}
            className="field"
            autoComplete="email"
            data-field="email"
          />
        </Field>
        <Field label={copy.firstName}>
          <input
            name="firstName"
            required
            className="field"
            autoComplete="given-name"
            data-field="firstName"
          />
        </Field>
        <Field label={copy.lastName}>
          <input
            name="lastName"
            required
            className="field"
            autoComplete="family-name"
            data-field="lastName"
          />
        </Field>
        <div className="grid gap-2 text-sm font-medium text-[var(--peace-ink)]">
          <span>{copy.country}</span>
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
                      setCountrySearch(country);
                      setCustomCountry("");
                      clearCitySelection();
                      setShowCountryOptions(false);
                    }}
                  >
                    {country}
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
                setCustomCountry(event.target.value);
                clearCitySelection();
              }}
            />
          ) : null}
        </div>
        <div className="grid gap-2 text-sm font-medium text-[var(--peace-ink)]">
          <span>{copy.city}</span>
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
        <Field label={copy.birthDate}>
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
        <Field label={copy.birthPlace}>
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
          <span>{copy.nationality}</span>
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
          ) : null}
        </div>
        <Field label={copy.preferredLanguage} className="sm:col-span-2">
          <select
            name="preferredLocale"
            className="field"
            defaultValue={locale}
            data-field="preferredLocale"
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.nativeLabel}
              </option>
            ))}
          </select>
        </Field>
      </section>

      <section className="grid gap-4 rounded-lg border border-[var(--peace-border)] bg-white p-5">
        <div className="grid gap-3 text-sm font-medium text-[var(--peace-ink)]">
          <span>{copy.accessibilityQuestion}</span>
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
                {copy.accessibilityTitle}
              </h2>
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
                    className="mt-1 h-4 w-4"
                    data-field="accessibilityAnswers"
                  />
                  <span>{difficulty.label[locale] ?? difficulty.label.en}</span>
                </label>
              ))}
            </div>
            <Field label={copy.accessibilityNotes}>
              <textarea
                name="accessibilityNotes"
                className="field min-h-24"
                data-field="accessibilityNotes"
              />
            </Field>
          </div>
        ) : null}
      </section>

      {!hasGroupLink ? (
      <section className="grid gap-4 rounded-lg border border-[var(--peace-border)] bg-white p-5">
        <div className="grid gap-3 text-sm font-medium text-[var(--peace-ink)]">
          <span>{copy.previousQuestion}</span>
          <input
            name="hasPreviousSantegidioParticipation"
            type="hidden"
            value={hasPreviousParticipation}
          />
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

        {hasPreviousParticipation === "yes" && !hasGroupLink ? (
          <div className="grid gap-3 text-sm font-medium text-[var(--peace-ink)]">
            <span>{copy.groupQuestion}</span>
            <input
              name="participatesWithGroup"
              type="hidden"
              value={participatesWithGroup}
            />
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

        {hasPreviousParticipation === "yes" &&
        participatesWithGroup === "yes" &&
        !hasGroupLink ? (
          <Field label={copy.groupLabel}>
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
      ) : null}

      <section className="grid gap-4 rounded-lg border border-[var(--peace-border)] bg-white p-5">
        <div>
          <h2 className="text-lg font-semibold">
            {copy.daysTitle}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--peace-muted)]">
            {copy.daysHelp}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {eventDays.map((day) => (
            <label
              key={day.value}
              className={`flex min-h-14 items-center gap-3 rounded-md border p-3 text-sm transition ${
                availabilityUnknown
                  ? "border-[var(--peace-border)] bg-[#eef5fa] text-[#718196]"
                  : "border-[var(--peace-border)] text-[var(--peace-ink)]"
              }`}
            >
              <input
                name="availabilityDays"
                type="checkbox"
                value={day.value}
                checked={selectedEventDays.includes(day.value)}
                disabled={availabilityUnknown}
                className="h-4 w-4"
                data-field="availabilityDays"
                onChange={(event) => {
                  markPromptFieldTouched("availabilityDays");
                  setSelectedEventDays((current) =>
                    event.target.checked
                      ? [...current, day.value]
                      : current.filter((value) => value !== day.value)
                  );
                }}
              />
              <span>{day.label}</span>
            </label>
          ))}
        </div>
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
                setSelectedEventDays([]);
              }
            }}
          />
          <span>{copy.daysUnknown}</span>
        </label>
        {!availabilityUnknown && selectedEventDays.length === 0 ? (
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
            {copy.privacyConsent}
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
              {copy.sensitiveConsent}
            </span>
          </label>
        ) : null}
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
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`grid gap-2 text-sm font-medium text-[var(--peace-ink)] ${className}`}>
      <span>{label}</span>
      {children}
    </label>
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
    selectedEventDays: string[];
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

  if (
    state.hasPreviousParticipation === "yes" &&
    !state.participatesWithGroup
  ) {
    focusField(form, "participatesWithGroup");
    return;
  }

  if (state.needsGroupChoice) {
    focusField(form, "group");
    return;
  }

  if (!state.availabilityUnknown && state.selectedEventDays.length === 0) {
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

function findCountryId(
  countries: PublicRegistrationOptions["countries"],
  value: string
): string | null {
  const normalized = normalizeMatchText(value);

  if (!normalized) {
    return null;
  }

  return (
    countries.find(
      (country) =>
        normalizeMatchText(country.name_it) === normalized ||
        normalizeMatchText(country.name_en) === normalized
    )?.id ?? null
  );
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

function buildEventDays(
  startsOn: string | null,
  endsOn: string | null,
  locale: SupportedLocale
): Array<{ value: string; label: string }> {
  if (!startsOn) {
    return [];
  }

  const start = parseDateOnly(startsOn);
  const end = parseDateOnly(endsOn ?? startsOn);

  if (!start || !end || end.getTime() < start.getTime()) {
    return [];
  }

  const days: Array<{ value: string; label: string }> = [];
  const formatter = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  for (
    let cursor = start;
    cursor.getTime() <= end.getTime();
    cursor = new Date(cursor.getTime() + DAY_IN_MS)
  ) {
    days.push({
      value: cursor.toISOString().slice(0, 10),
      label: formatter.format(cursor),
    });
  }

  return days;
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
