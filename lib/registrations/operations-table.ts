export const PARTICIPANT_COLUMNS = {
  name: "Partecipante",
  email: "Email",
  phone: "Telefono",
  country: "Paese",
  city: "Città",
  age: "Età",
  group: "Gruppo",
  service: "Servizio",
  tags: "Tag",
  status: "Stato",
  submittedAt: "Data iscrizione",
} as const;
export type ParticipantColumn = keyof typeof PARTICIPANT_COLUMNS;
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
export function parseTablePreferences(value: unknown): TablePreferences {
  const input =
    value && typeof value === "object"
      ? (value as Partial<TablePreferences>)
      : {};
  const columns = Array.isArray(input.columns)
    ? [...new Set(input.columns)].filter(isParticipantColumn)
    : DEFAULT_TABLE_PREFERENCES.columns;
  return {
    columns: ["name", ...columns.filter((column) => column !== "name")],
    sort: isParticipantColumn(input.sort) ? input.sort : "name",
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
