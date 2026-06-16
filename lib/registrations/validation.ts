export const PRIVACY_VERSION = "2026-06-14-gdpr-accessibility";

export type RegistrationInput = {
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  birthPlace: string | null;
  nationality: string | null;
  preferredLocale: "it" | "en";
  countryId: string | null;
  countryOther: string | null;
  cityId: string | null;
  cityOther: string | null;
  hasPreviousSantegidioParticipation: boolean | null;
  participatesWithGroup: boolean | null;
  groupId: string | null;
  groupName: string | null;
  cannotFindLeader: boolean;
  attendanceChoice: "yes" | "no" | "unknown";
  availabilityDays: string[];
  availabilityUnknown: boolean;
  momentAttendanceChoices: Record<string, "yes" | "no" | "unknown">;
  hasAccessibilityNeeds: boolean | null;
  accessibilityAnswers: Record<string, boolean>;
  accessibilityNotes: string | null;
  needsOperationalSupport: boolean;
  privacyAccepted: boolean;
  dataProcessingAccepted: boolean;
};

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+[1-9]\d{6,14}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeEmail(value: FormDataEntryValue | string | null): string {
  return String(value ?? "").trim().toLowerCase();
}

export function optionalText(value: FormDataEntryValue | string | null): string | null {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

export function optionalUuid(
  value: FormDataEntryValue | string | null
): string | null {
  const text = optionalText(value);
  return text && UUID_PATTERN.test(text) ? text : null;
}

export function parseRegistrationForm(formData: FormData): ValidationResult<RegistrationInput> {
  const email = normalizeEmail(formData.get("email"));
  const firstName = optionalText(formData.get("firstName")) ?? "";
  const lastName = optionalText(formData.get("lastName")) ?? "";
  const birthDate = optionalDate(formData.get("birthDate"));
  const birthPlace = optionalText(formData.get("birthPlace"));
  const nationality = optionalText(formData.get("nationality"));
  const preferredLocale = formData.get("preferredLocale") === "en" ? "en" : "it";
  const participatesWithGroup = parseBooleanChoice(
    formData.get("participatesWithGroup")
  );
  const cannotFindLeader = formData.get("cannotFindLeader") === "on";
  const groupId = optionalUuid(formData.get("groupId"));
  const hasAccessibilityNeeds = parseBooleanChoice(
    formData.get("hasAccessibilityNeeds")
  );
  const accessibilityAnswers = parseAccessibilityAnswers(
    formData,
    hasAccessibilityNeeds
  );
  const privacyAccepted = formData.get("privacyAccepted") === "on";
  const dataProcessingAccepted = formData.get("dataProcessingAccepted") === "on";
  const availabilityUnknown = formData.get("availabilityUnknown") === "on";

  const value: RegistrationInput = {
    email,
    phone: normalizePhone(formData.get("phone")),
    firstName,
    lastName,
    birthDate,
    birthPlace,
    nationality,
    preferredLocale,
    countryId: null,
    countryOther: optionalText(formData.get("countryOther")),
    cityId: null,
    cityOther: optionalText(formData.get("cityOther")),
    hasPreviousSantegidioParticipation: parseBooleanChoice(
      formData.get("hasPreviousSantegidioParticipation")
    ),
    participatesWithGroup,
    groupId: participatesWithGroup === true && !cannotFindLeader ? groupId : null,
    groupName:
      participatesWithGroup === true && !cannotFindLeader
        ? optionalText(formData.get("groupName"))
        : null,
    cannotFindLeader: participatesWithGroup === true ? cannotFindLeader : false,
    attendanceChoice: parseAttendanceChoice(formData.get("attendanceChoice")),
    availabilityDays: availabilityUnknown ? [] : parseAvailabilityDays(formData),
    availabilityUnknown,
    momentAttendanceChoices: parseMomentAttendanceChoices(formData),
    hasAccessibilityNeeds,
    accessibilityAnswers,
    accessibilityNotes: optionalText(formData.get("accessibilityNotes")),
    needsOperationalSupport:
      hasAccessibilityNeeds === true &&
      (formData.get("needsOperationalSupport") === "on" ||
        Boolean(accessibilityAnswers.eventAssistance)),
    privacyAccepted,
    dataProcessingAccepted,
  };

  const errors = validateRegistrationInput(value);
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value };
}

export function validateRegistrationInput(input: RegistrationInput): string[] {
  const errors: string[] = [];

  if (!EMAIL_PATTERN.test(input.email)) {
    errors.push("Inserisci un indirizzo email valido.");
  }

  if (input.firstName.length < 2) {
    errors.push("Inserisci il nome.");
  }

  if (input.lastName.length < 2) {
    errors.push("Inserisci il cognome.");
  }

  if (!input.birthDate) {
    errors.push("Inserisci la data di nascita.");
  }

  if (!input.birthPlace) {
    errors.push("Inserisci il luogo di nascita, indicando paese e città.");
  }

  if (!input.nationality) {
    errors.push("Seleziona la nazionalità.");
  }

  if (!input.countryId && !input.countryOther) {
    errors.push("Seleziona un paese o indica un paese non presente in lista.");
  }

  if (!input.cityId && !input.cityOther) {
    errors.push("Seleziona una città o indica una città non presente in lista.");
  }

  if (input.phone && !PHONE_PATTERN.test(input.phone)) {
    errors.push("Inserisci un numero di telefono valido con prefisso internazionale.");
  }

  if (input.hasAccessibilityNeeds === null) {
    errors.push("Indica se hai disabilità o bisogni di accessibilità.");
  }

  if (
    input.hasAccessibilityNeeds === true &&
    Object.keys(input.accessibilityAnswers).length === 0
  ) {
    errors.push("Seleziona almeno un bisogno o una difficoltà di accessibilità.");
  }

  if (input.hasPreviousSantegidioParticipation === null) {
    errors.push(
      "Indica se hai già partecipato ad attività della Comunità di Sant'Egidio."
    );
  }

  if (
    input.hasPreviousSantegidioParticipation === true &&
    input.participatesWithGroup === null
  ) {
    errors.push("Indica se parteciperai con un gruppo.");
  }

  if (
    input.hasPreviousSantegidioParticipation === true &&
    input.participatesWithGroup === true &&
    !input.cannotFindLeader &&
    !input.groupId &&
    !input.groupName
  ) {
    errors.push("Se partecipi con un gruppo, seleziona il gruppo.");
  }

  if (!input.availabilityUnknown && input.availabilityDays.length === 0) {
    errors.push(
      "Seleziona almeno un giorno di presenza o indica che lo comunicherai in seguito."
    );
  }

  if (!input.privacyAccepted || !input.dataProcessingAccepted) {
    errors.push("Accetta privacy e trattamento dati per completare l'iscrizione.");
  }

  return errors;
}

function parseAvailabilityDays(formData: FormData): string[] {
  return formData
    .getAll("availabilityDays")
    .map((value) => String(value))
    .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function normalizePhone(value: FormDataEntryValue | string | null): string | null {
  const text = optionalText(value);

  if (!text) {
    return null;
  }

  return text.replace(/[\s().-]/g, "");
}

function parseBooleanChoice(value: FormDataEntryValue | null): boolean | null {
  if (value === "yes") {
    return true;
  }

  if (value === "no") {
    return false;
  }

  return null;
}

function parseAttendanceChoice(
  value: FormDataEntryValue | null
): "yes" | "no" | "unknown" {
  return value === "yes" || value === "no" ? value : "unknown";
}

function parseMomentAttendanceChoices(
  formData: FormData
): Record<string, "yes" | "no" | "unknown"> {
  const choices: Record<string, "yes" | "no" | "unknown"> = {};

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("moment_")) {
      continue;
    }

    const momentId = key.slice("moment_".length);

    if (!UUID_PATTERN.test(momentId)) {
      continue;
    }

    choices[momentId] = parseAttendanceChoice(value);
  }

  return choices;
}

function optionalDate(value: FormDataEntryValue | null): string | null {
  const text = optionalText(value);

  if (!text) {
    return null;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function parseAccessibilityAnswers(
  formData: FormData,
  hasAccessibilityNeeds: boolean | null
): Record<string, boolean> {
  if (hasAccessibilityNeeds !== true) {
    return {};
  }

  const keys = [
    "seeing",
    "hearing",
    "walkingOrSteps",
    "selfCare",
    "rememberingOrConcentrating",
    "communicating",
    "wheelchairOrMobilityAid",
    "eventAssistance",
  ];

  return Object.fromEntries(
    keys
      .filter((key) => formData.get(`accessibility_${key}`) === "on")
      .map((key) => [key, true])
  );
}
