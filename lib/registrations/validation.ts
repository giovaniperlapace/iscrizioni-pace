export const PRIVACY_VERSION = "2026-06-14-initial";

export type RegistrationInput = {
  email: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  preferredLocale: "it" | "en";
  countryId: string | null;
  countryOther: string | null;
  cityId: string | null;
  cityOther: string | null;
  hasPreviousSantegidioParticipation: boolean | null;
  participatesWithGroup: boolean | null;
  groupId: string | null;
  attendanceChoice: "yes" | "no" | "unknown";
  accessibilityAnswers: Record<string, string>;
  accessibilityNotes: string | null;
  needsOperationalSupport: boolean;
  privacyAccepted: boolean;
  dataProcessingAccepted: boolean;
};

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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
  const preferredLocale = formData.get("preferredLocale") === "en" ? "en" : "it";
  const participatesWithGroup = parseBooleanChoice(
    formData.get("participatesWithGroup")
  );
  const groupId = optionalUuid(formData.get("groupId"));
  const accessibilityAnswers = parseAccessibilityAnswers(formData);
  const privacyAccepted = formData.get("privacyAccepted") === "on";
  const dataProcessingAccepted = formData.get("dataProcessingAccepted") === "on";

  const value: RegistrationInput = {
    email,
    firstName,
    lastName,
    birthDate,
    preferredLocale,
    countryId: optionalUuid(formData.get("countryId")),
    countryOther: optionalText(formData.get("countryOther")),
    cityId: optionalUuid(formData.get("cityId")),
    cityOther: optionalText(formData.get("cityOther")),
    hasPreviousSantegidioParticipation: parseBooleanChoice(
      formData.get("hasPreviousSantegidioParticipation")
    ),
    participatesWithGroup,
    groupId: participatesWithGroup === true ? groupId : null,
    attendanceChoice: parseAttendanceChoice(formData.get("attendanceChoice")),
    accessibilityAnswers,
    accessibilityNotes: optionalText(formData.get("accessibilityNotes")),
    needsOperationalSupport:
      formData.get("needsOperationalSupport") === "on" ||
      hasAnySupportNeed(accessibilityAnswers),
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

  if (!input.countryId && !input.countryOther) {
    errors.push("Seleziona un paese o indica un paese non presente in lista.");
  }

  if (!input.cityId && !input.cityOther) {
    errors.push("Seleziona una citta' o indica una citta' non presente in lista.");
  }

  if (input.participatesWithGroup === true && !input.groupId) {
    errors.push("Se partecipi con un gruppo, seleziona il gruppo.");
  }

  if (!input.privacyAccepted || !input.dataProcessingAccepted) {
    errors.push("Accetta privacy e trattamento dati per completare l'iscrizione.");
  }

  return errors;
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

function optionalDate(value: FormDataEntryValue | null): string | null {
  const text = optionalText(value);

  if (!text) {
    return null;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function parseAccessibilityAnswers(formData: FormData): Record<string, string> {
  const keys = [
    "seeing",
    "hearing",
    "walking",
    "remembering",
    "selfCare",
    "communicating",
  ];

  return Object.fromEntries(
    keys.map((key) => [
      key,
      String(formData.get(`accessibility_${key}`) ?? "none"),
    ])
  );
}

function hasAnySupportNeed(answers: Record<string, string>): boolean {
  return Object.values(answers).some(
    (answer) => answer === "a_lot" || answer === "cannot_do"
  );
}
