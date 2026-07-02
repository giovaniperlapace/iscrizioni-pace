import {
  DEFAULT_LOCALE,
  type SupportedLocale,
} from "../i18n/config.ts";

import {
  normalizeEmail,
  optionalText,
  optionalUuid,
  type ValidationResult,
} from "./validation.ts";
import {
  attendanceSlotKey,
  parseAttendanceSlot,
  type AttendanceSlot,
} from "./attendance-slots.ts";

export type ManualRegistrationInput = {
  groupId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  preferredLocale: SupportedLocale;
  availabilitySlots: AttendanceSlot[];
  availabilityUnknown: boolean;
  hasAccessibilityNeeds: boolean | null;
  accessibilityAnswers: Record<string, boolean>;
  accessibilityNotes: string | null;
  needsOperationalSupport: boolean;
  leaderNote: string | null;
  consentConfirmed: boolean;
};

const PHONE_PATTERN = /^\+[1-9]\d{6,14}$/;

export function parseManualRegistrationForm(
  formData: FormData
): ValidationResult<ManualRegistrationInput> {
  const email = normalizeEmail(formData.get("email"));
  const value: ManualRegistrationInput = {
    groupId: optionalUuid(formData.get("groupId")) ?? "",
    firstName: optionalText(formData.get("firstName")) ?? "",
    lastName: optionalText(formData.get("lastName")) ?? "",
    email: email.length > 0 ? email : null,
    phone: normalizePhone(formData.get("phone")),
    birthDate: optionalDate(formData.get("birthDate")),
    preferredLocale: DEFAULT_LOCALE,
    availabilityUnknown: formData.get("availabilityUnknown") === "on",
    availabilitySlots: parseAvailabilitySlots(formData),
    hasAccessibilityNeeds: parseBooleanChoice(formData.get("hasAccessibilityNeeds")),
    accessibilityAnswers: parseAccessibilityAnswers(formData),
    accessibilityNotes: optionalText(formData.get("accessibilityNotes")),
    needsOperationalSupport: formData.get("needsOperationalSupport") === "on",
    leaderNote: normalizeLeaderNote(formData.get("leaderNote")),
    consentConfirmed: formData.get("consentConfirmed") === "on",
  };
  const errors = validateManualRegistrationInput(value);

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value };
}

export function validateManualRegistrationInput(
  input: ManualRegistrationInput
): string[] {
  const errors: string[] = [];

  if (!input.groupId) {
    errors.push("Seleziona un gruppo.");
  }

  if (input.firstName.length < 2) {
    errors.push("Inserisci il nome.");
  }

  if (input.lastName.length < 2) {
    errors.push("Inserisci il cognome.");
  }

  if (!input.email && !input.phone) {
    errors.push("Inserisci almeno email o telefono.");
  }

  if (input.phone && !PHONE_PATTERN.test(input.phone)) {
    errors.push("Inserisci un telefono valido con prefisso internazionale.");
  }

  if (!input.availabilityUnknown && input.availabilitySlots.length === 0) {
    errors.push(
      "Seleziona almeno un giorno di presenza o indica che sarà confermato più avanti."
    );
  }

  if (!input.consentConfirmed) {
    errors.push("Conferma di avere il consenso della persona iscritta.");
  }

  return errors;
}

export function buildManualRegistrationQuestionnaireAnswers(
  input: ManualRegistrationInput,
  group: { id: string; name: string | null }
) {
  return {
    source: "capogruppo_manual",
    identity: {
      firstName: input.firstName,
      lastName: input.lastName,
      birthDate: input.birthDate,
    },
    contact: {
      hasEmail: Boolean(input.email),
      hasPhone: Boolean(input.phone),
    },
    groupParticipation: {
      hasPreviousSantegidioParticipation: true,
      participatesWithGroup: true,
      selectedGroupId: group.id,
      selectedGroupName: group.name,
      enteredByGroupLeader: true,
    },
    attendance: {
      overallChoice: input.availabilityUnknown ? "unknown" : "yes",
      availabilityUnknown: input.availabilityUnknown,
      availabilitySlots: input.availabilitySlots,
      availabilityDays: [...new Set(input.availabilitySlots.map((slot) => slot.day))],
    },
    accessibility: {
      hasAccessibilityNeeds: input.hasAccessibilityNeeds,
      washingtonGroupAnswers: input.accessibilityAnswers,
      needsOperationalSupport: input.needsOperationalSupport,
      operationalNotes: input.accessibilityNotes,
    },
    consents: {
      privacyAccepted: true,
      dataProcessingAccepted: true,
      acceptedByGroupLeader: true,
    },
  };
}

function normalizePhone(value: FormDataEntryValue | string | null): string | null {
  const text = optionalText(value);

  if (!text) {
    return null;
  }

  return text.replace(/[\s().-]/g, "");
}

function optionalDate(value: FormDataEntryValue | null): string | null {
  const text = optionalText(value);

  if (!text) {
    return null;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function parseAvailabilitySlots(formData: FormData): AttendanceSlot[] {
  if (formData.get("availabilityUnknown") === "on") {
    return [];
  }

  const slots = new Map<string, AttendanceSlot>();

  for (const rawValue of formData.getAll("availabilitySlots")) {
    const slot = parseAttendanceSlot(String(rawValue));

    if (slot) {
      slots.set(attendanceSlotKey(slot), slot);
    }
  }

  for (const rawValue of formData.getAll("availabilityDays")) {
    const day = String(rawValue);

    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      for (const part of ["morning", "afternoon"] as const) {
        const slot = { day, part };
        slots.set(attendanceSlotKey(slot), slot);
      }
    }
  }

  return [...slots.values()];
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

function parseAccessibilityAnswers(formData: FormData): Record<string, boolean> {
  const keys = [
    "hearing",
    "walkingOrSteps",
    "wheelchairOrMobilityAid",
  ];

  return Object.fromEntries(
    keys
      .filter((key) => formData.get(`accessibility_${key}`) === "on")
      .map((key) => [key, true])
  );
}

function normalizeLeaderNote(value: FormDataEntryValue | null): string | null {
  const text = optionalText(value);

  return text ? text.replace(/\s+/g, " ").slice(0, 800) : null;
}
