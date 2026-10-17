export const PARTICIPANT_COLUMNS = {
  name: "Partecipante",
  email: "Email",
  phone: "Telefono",
  country: "Paese",
  nationality: "Nazionalità",
  association: "Associazione / organizzazione",
  sex: "Sesso",
  city: "Città",
  age: "Età",
  group: "Gruppo",
  service: "Servizio",
  tags: "Tag",
  attendance: "Giorni di presenza",
  submittedAt: "Data iscrizione",
  accessibility: "Informazioni sulla disabilità",
} as const;
export type ParticipantColumn = keyof typeof PARTICIPANT_COLUMNS;
export const PARTICIPANTS_PAGE_SIZE = 100;

/** Paginate only after filtering and ordering the complete authorized result. */
export function paginateParticipants<T>(rows: T[], requestedPage: string | null) {
  const parsed = Number(requestedPage);
  const pageCount = Math.max(1, Math.ceil(rows.length / PARTICIPANTS_PAGE_SIZE));
  const page = Math.min(
    pageCount,
    Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1,
  );
  const offset = (page - 1) * PARTICIPANTS_PAGE_SIZE;
  return {
    page,
    pageCount,
    total: rows.length,
    first: rows.length ? offset + 1 : 0,
    last: Math.min(offset + PARTICIPANTS_PAGE_SIZE, rows.length),
    rows: rows.slice(offset, offset + PARTICIPANTS_PAGE_SIZE),
  };
}

export type TablePreferences = {
  columns: ParticipantColumn[];
  sort: ParticipantColumn;
  direction: "asc" | "desc";
};
export const DEFAULT_TABLE_PREFERENCES: TablePreferences = {
  columns: ["name", "email", "phone", "group", "service", "tags"],
  sort: "name",
  direction: "asc",
};
export function parseTablePreferences(value: unknown, canReadAccessibility = true): TablePreferences {
  const input =
    value && typeof value === "object"
      ? (value as Partial<TablePreferences>)
      : {};
  const columns = Array.isArray(input.columns)
    ? [...new Set(input.columns)].filter((column): column is ParticipantColumn => isParticipantColumn(column) && (canReadAccessibility || column !== "accessibility"))
    : DEFAULT_TABLE_PREFERENCES.columns;
  return {
    columns: ["name", ...columns.filter((column) => column !== "name")],
    sort: isParticipantColumn(input.sort) && (canReadAccessibility || input.sort !== "accessibility") ? input.sort : "name",
    direction: input.direction === "desc" ? "desc" : "asc",
  };
}
export function isParticipantColumn(
  value: unknown,
): value is ParticipantColumn {
  return typeof value === "string" && Object.hasOwn(PARTICIPANT_COLUMNS, value);
}
// Only the participants section and known state parameters can be returned to.
export function operationsReturnPath(
  value: unknown,
  dashboard: "admin" | "manager",
  nav = "full",
): string {
  const params = new URLSearchParams();
  if (
    typeof value === "string" &&
    value.startsWith(`/dashboard/${dashboard}?`)
  ) {
    const source = new URL(value, "https://local.invalid").searchParams;
    for (const key of [
      "q",
      "contact",
      "group",
      "tag",
      "service",
      "status",
      "stat",
      "view",
      "sort",
      "direction",
      "columns",
      "nav",
      "edit",
      "duplicateShow",
      "duplicatePage",
      "participantPage",
    ]) {
      if (source.has(key)) params.set(key, source.get(key)!);
    }
  }
  params.set("section", "iscritti");
  params.set(
    "nav",
    params.get("nav") === "mini" || nav === "mini" ? "mini" : "full",
  );
  return `/dashboard/${dashboard}?${params}`;
}
