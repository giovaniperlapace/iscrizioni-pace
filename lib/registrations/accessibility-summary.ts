import type { SupportedLocale } from "../i18n/config.ts";
import { ACCESSIBILITY_DIFFICULTIES } from "../questionnaire/registration.ts";

/** Report only the declared choices, without inferring diagnoses or support requests. */
export function declaredAccessibilityDifficulties(answers: unknown) {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return [];
  const values = answers as Record<string, unknown>;
  return ACCESSIBILITY_DIFFICULTIES.filter(({ key }) => values[key] === true);
}

export function accessibilitySummary(answers: unknown, locale: SupportedLocale = "it"): string {
  return declaredAccessibilityDifficulties(answers)
    .map(({ label }) => label[locale])
    .join("; ") || "—";
}
