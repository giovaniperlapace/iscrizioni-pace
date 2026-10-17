import type { OperationsParticipantRow } from "./operations-types.ts";
import type { ParticipantColumn, TablePreferences } from "./operations-table.ts";
import type { SupportedLocale } from "../i18n/config.ts";
import { attendanceSummary } from "./attendance-summary.ts";
import { nationalityName } from "./nationality-names.ts";
import { calculateAgeAtDate } from "../groups/matching.ts";

export function participantSortValue(row: OperationsParticipantRow, column: ParticipantColumn,
  startsOn: string | null, locale: SupportedLocale, sexText: (id: string) => string | null = () => null): string | number | null {
  switch (column) {
    case "sex": return row.deletedAt ? null : sexText(row.registrationId);
    case "association": return row.association ?? null;
    case "nationality": return nationalityName(row.nationality, locale);
    case "accessibility": return row.accessibility ?? "—";
    case "attendance": return attendanceSummary(row.attendance, locale);
    case "age": return calculateAgeAtDate(row.birthDate, startsOn);
    case "group": return row.currentGroupName;
    case "service": return row.service?.serviceLabel ?? null;
    case "tags": return row.tags.map(tag => tag.label).sort().join(", ");
    default: return row[column];
  }
}

export function sortOperationsParticipants(rows: OperationsParticipantRow[], preferences: TablePreferences,
  startsOn: string | null, locale: SupportedLocale, sexText?: (id: string) => string | null) {
  const collator = new Intl.Collator("it", { numeric: true, sensitivity: "base" });
  // Format expensive values once per person, not twice per comparison.
  const values = new Map(rows.map(row => [row.registrationId, participantSortValue(row, preferences.sort, startsOn, locale, sexText)]));
  return [...rows].sort((a, b) => {
    const av = values.get(a.registrationId)!, bv = values.get(b.registrationId)!;
    if (av === null || bv === null) return av === bv ? a.registrationId.localeCompare(b.registrationId) : av === null ? 1 : -1;
    const comparison = typeof av === "number" && typeof bv === "number" ? av - bv : collator.compare(String(av), String(bv));
    return (preferences.direction === "asc" ? comparison : -comparison) || a.registrationId.localeCompare(b.registrationId);
  });
}
