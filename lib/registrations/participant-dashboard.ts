import {
  DEFAULT_LOCALE,
  type SupportedLocale,
  normalizeLocale,
} from "../i18n/config.ts";

import { optionalText } from "./validation.ts";

export type ParticipantDashboardUpdate = {
  registrationId: string;
  phone: string | null;
  preferredLocale: SupportedLocale;
  availabilityUnknown: boolean;
  availabilityDays: string[];
  momentAttendanceChoices: Record<string, "yes" | "no" | "unknown">;
  accessibilityAnswers: Record<string, boolean>;
  needsOperationalSupport: boolean;
  accessibilityNotes: string | null;
};

export type ParticipantDashboardValidation =
  | { ok: true; value: ParticipantDashboardUpdate }
  | { ok: false; errors: string[] };

const PHONE_PATTERN = /^\+[1-9]\d{6,14}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseParticipantDashboardUpdate(
  formData: FormData
): ParticipantDashboardValidation {
  const registrationId = optionalText(formData.get("registrationId")) ?? "";
  const phone = normalizePhone(formData.get("phone"));
  const preferredLocale =
    normalizeLocale(String(formData.get("preferredLocale") ?? "")) ?? DEFAULT_LOCALE;
  const availabilityUnknown = formData.get("availabilityUnknown") === "on";
  const hasAccessibilityNeeds = formData.get("hasAccessibilityNeeds") === "on";

  const value: ParticipantDashboardUpdate = {
    registrationId,
    phone,
    preferredLocale,
    availabilityUnknown,
    availabilityDays: availabilityUnknown ? [] : parseAvailabilityDays(formData),
    momentAttendanceChoices: parseMomentAttendanceChoices(formData),
    accessibilityAnswers: hasAccessibilityNeeds
      ? parseAccessibilityAnswers(formData)
      : {},
    needsOperationalSupport: hasAccessibilityNeeds,
    accessibilityNotes: hasAccessibilityNeeds
      ? optionalText(formData.get("accessibilityNotes"))
      : null,
  };

  const errors = validateParticipantDashboardUpdate(value);

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value };
}

export function validateParticipantDashboardUpdate(
  input: ParticipantDashboardUpdate
): string[] {
  const errors: string[] = [];

  if (!UUID_PATTERN.test(input.registrationId)) {
    errors.push("Iscrizione non valida.");
  }

  if (input.phone && !PHONE_PATTERN.test(input.phone)) {
    errors.push("Inserisci un numero di telefono valido con prefisso internazionale.");
  }

  if (!input.availabilityUnknown && input.availabilityDays.length === 0) {
    errors.push(
      "Seleziona almeno un giorno di presenza o indica che lo comunicherai in seguito."
    );
  }

  return errors;
}

export function canParticipantEditRegistration(
  registration: {
    status: string | null;
    events?: { registration_closes_at?: string | null } | null;
  },
  now = new Date()
): boolean {
  if (registration.status === "cancelled") {
    return false;
  }

  const closesAt = registration.events?.registration_closes_at;

  if (!closesAt) {
    return true;
  }

  const closeDate = new Date(closesAt);

  return Number.isNaN(closeDate.getTime()) || closeDate.getTime() >= now.getTime();
}

export function diffParticipantDashboardUpdate(
  before: {
    phone: string | null;
    preferredLocale: string | null;
    availabilityDays: string[];
    availabilityUnknown: boolean;
    momentAttendanceChoices: Record<string, string>;
    accessibilityAnswers: Record<string, boolean>;
    needsOperationalSupport: boolean | null;
    accessibilityNotes: string | null;
  },
  after: ParticipantDashboardUpdate
): string[] {
  const changed: string[] = [];

  if ((before.phone ?? "") !== (after.phone ?? "")) {
    changed.push("phone");
  }

  if ((before.preferredLocale ?? "it") !== after.preferredLocale) {
    changed.push("preferred_locale");
  }

  if (before.availabilityUnknown !== after.availabilityUnknown) {
    changed.push("availability_unknown");
  }

  if (!sameStringList(before.availabilityDays, after.availabilityDays)) {
    changed.push("availability_days");
  }

  if (!sameChoiceMap(before.momentAttendanceChoices, after.momentAttendanceChoices)) {
    changed.push("moment_attendance_choices");
  }

  if (!sameBooleanMap(before.accessibilityAnswers, after.accessibilityAnswers)) {
    changed.push("accessibility_answers");
  }

  if (Boolean(before.needsOperationalSupport) !== after.needsOperationalSupport) {
    changed.push("needs_operational_support");
  }

  if ((before.accessibilityNotes ?? "") !== (after.accessibilityNotes ?? "")) {
    changed.push("accessibility_notes");
  }

  return changed;
}

export function preserveAccessibilityUnlessEdited(
  input: ParticipantDashboardUpdate,
  previous: {
    accessibilityAnswers: Record<string, boolean>;
    needsOperationalSupport: boolean | null;
    accessibilityNotes: string | null;
  },
  updatesAccessibility: boolean
): ParticipantDashboardUpdate {
  if (updatesAccessibility) {
    return input;
  }

  return {
    ...input,
    accessibilityAnswers: previous.accessibilityAnswers,
    needsOperationalSupport: Boolean(previous.needsOperationalSupport),
    accessibilityNotes: previous.accessibilityNotes,
  };
}

function parseAvailabilityDays(formData: FormData): string[] {
  return uniqueStrings(
    formData
      .getAll("availabilityDays")
      .map((value) => String(value))
      .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
  );
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

    choices[momentId] = parseChoice(value);
  }

  return choices;
}

function parseAccessibilityAnswers(formData: FormData): Record<string, boolean> {
  const answers: Record<string, boolean> = {};

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("accessibility_") || value !== "on") {
      continue;
    }

    const answerKey = key.slice("accessibility_".length);

    if (/^[a-zA-Z][a-zA-Z0-9]*$/.test(answerKey)) {
      answers[answerKey] = true;
    }
  }

  return answers;
}

function normalizePhone(value: FormDataEntryValue | string | null): string | null {
  const text = optionalText(value);

  if (!text) {
    return null;
  }

  return text.replace(/[\s().-]/g, "");
}

function parseChoice(value: FormDataEntryValue): "yes" | "no" | "unknown" {
  return value === "yes" || value === "no" ? value : "unknown";
}

function sameStringList(left: string[], right: string[]): boolean {
  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();

  return (
    leftSorted.length === rightSorted.length &&
    leftSorted.every((value, index) => value === rightSorted[index])
  );
}

function sameChoiceMap(
  left: Record<string, string>,
  right: Record<string, string>
): boolean {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();

  return (
    sameStringList(leftKeys, rightKeys) &&
    leftKeys.every((key) => left[key] === right[key])
  );
}

function sameBooleanMap(
  left: Record<string, boolean>,
  right: Record<string, boolean>
): boolean {
  const leftKeys = Object.keys(left).filter((key) => left[key]).sort();
  const rightKeys = Object.keys(right).filter((key) => right[key]).sort();

  return sameStringList(leftKeys, rightKeys);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}
