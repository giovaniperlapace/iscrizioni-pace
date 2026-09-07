import { LEADER_SERVICE_STATUS_COPY } from "./leader-table-copy.ts";
import type { AssignmentView } from "./leader-assignments.ts";
import { calculateAgeAtDate } from "./matching.ts";
import {
  parseTablePreferences,
  type ParticipantColumn,
  type TablePreferences,
} from "../registrations/operations-table.ts";
import type { SupportedLocale } from "../i18n/config.ts";

export type LeaderTableRow = Pick<
  AssignmentView,
  | "id"
  | "registrationId"
  | "groupId"
  | "participantName"
  | "participantCode"
  | "participantPlace"
  | "participantEmail"
  | "participantPhone"
  | "participantCountry"
  | "participantCity"
  | "birthDate"
  | "groupName"
  | "submittedAt"
  | "tagIds"
> & {
  serviceLabel: string | null;
  serviceStatus?: keyof typeof LEADER_SERVICE_STATUS_COPY.it | null;
  tags: { id: string; label: string; color: string }[];
};
export function toLeaderTableRow(row: AssignmentView): LeaderTableRow {
  return {
    id: row.id,
    registrationId: row.registrationId,
    groupId: row.groupId,
    participantName: row.participantName,
    participantCode: row.participantCode,
    participantPlace: row.participantPlace,
    participantEmail: row.participantEmail,
    participantPhone: row.participantPhone,
    participantCountry: row.participantCountry,
    participantCity: row.participantCity,
    birthDate: row.birthDate,
    groupName: row.groupName,
    submittedAt: row.submittedAt,
    tagIds: row.tagIds,
    serviceLabel: row.service?.serviceLabel ?? null,
    serviceStatus: row.service?.status ?? null,
    tags: row.tags.map(({ id, label, color }) => ({ id, label, color })),
  };
}
export function leaderColumnValue(
  row: LeaderTableRow,
  column: ParticipantColumn,
  startsOn: string | null,
): string | number | null {
  switch (column) {
    case "name":
      return row.participantName;
    case "email":
      return row.participantEmail;
    case "phone":
      return row.participantPhone;
    case "country":
      return row.participantCountry;
    case "city":
      return row.participantCity;
    case "age":
      return calculateAgeAtDate(row.birthDate, startsOn);
    case "group":
      return row.groupName;
    case "service":
      return row.serviceLabel;
    case "tags":
      return (
        row.tags
          .map((tag) => tag.label)
          .sort()
          .join("; ") || null
      );
    case "submittedAt":
      return row.submittedAt;
  }
}
export function leaderCellText(
  row: LeaderTableRow,
  column: ParticipantColumn,
  startsOn: string | null,
  locale: SupportedLocale,
): string {
  const value = leaderColumnValue(row, column, startsOn);
  if (column === "service" && value && row.serviceStatus)
    return `${value}\n${LEADER_SERVICE_STATUS_COPY[locale][row.serviceStatus]}`;
  if (column === "submittedAt" && value)
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeZone: "Europe/Rome",
    }).format(new Date(String(value)));
  return String(value ?? "—");
}
export function filterLeaderRows<
  T extends Pick<
    LeaderTableRow,
    | "participantName"
    | "participantCode"
    | "participantEmail"
    | "participantPhone"
    | "groupId"
    | "tagIds"
  >,
>(rows: T[], params: URLSearchParams): T[] {
  const q = (params.get("q") ?? "").trim().slice(0, 80).toLowerCase();
  const contact = (params.get("contact") ?? "")
    .trim()
    .slice(0, 80)
    .toLowerCase();
  const group = params.get("group")?.trim() || "all";
  const tag = params.get("tag")?.trim() || "all";
  return rows.filter(
    (row) =>
      [row.participantName, row.participantCode]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q) &&
      [row.participantEmail, row.participantPhone]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(contact) &&
      (group === "all" || row.groupId === group) &&
      (tag === "all" ||
        (tag === "none" ? row.tagIds.length === 0 : row.tagIds.includes(tag))),
  );
}
export function sortLeaderRows(
  rows: LeaderTableRow[],
  preferences: TablePreferences,
  startsOn: string | null,
  locale: SupportedLocale,
): LeaderTableRow[] {
  return [...rows].sort((a, b) => {
    const av = leaderColumnValue(a, preferences.sort, startsOn),
      bv = leaderColumnValue(b, preferences.sort, startsOn);
    if (av === null || bv === null)
      return av === bv ? a.id.localeCompare(b.id) : av === null ? 1 : -1;
    const cmp =
      typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv), locale, {
            numeric: true,
            sensitivity: "base",
          });
    return (
      (preferences.direction === "asc" ? cmp : -cmp) || a.id.localeCompare(b.id)
    );
  });
}
export function leaderPreferences(
  params: URLSearchParams,
  stored: unknown = undefined,
): TablePreferences {
  const base = parseTablePreferences(stored);
  return parseTablePreferences({
    columns: params.has("columns")
      ? params.get("columns")!.split(",")
      : base.columns,
    sort: params.get("sort") ?? base.sort,
    direction: params.get("direction") ?? base.direction,
  });
}
// Accept only this dashboard and known table state. Never reflect arbitrary URLs.
export function leaderReturnPath(
  value: unknown,
  updates: Record<string, string | null> = {},
): string {
  const params = new URLSearchParams();
  if (typeof value === "string" && value.startsWith("/dashboard/capogruppo?")) {
    const source = new URL(value, "https://local.invalid").searchParams;
    for (const key of [
      "q",
      "contact",
      "group",
      "tag",
      "columns",
      "sort",
      "direction",
      "assignmentId",
    ]) {
      if (source.has(key)) params.set(key, source.get(key)!);
    }
  }
  for (const [key, val] of Object.entries(updates)) {
    if (val === null) params.delete(key);
    else params.set(key, val);
  }
  return `/dashboard/capogruppo?${params}`;
}
