export const FORUM_RECEPTION_ROLE = "accoglienza_forum_eventi";
export const FORUM_RECEPTION_LABEL = "Accoglienza forum ed eventi";
export type DutyOption = { key: string; title: string; room: string | null; kind: "panel" | "ceremony" | "verification"; availableFrom?: string | null; availableUntil?: string | null };
export function dutySummary(keys: string[], choices: DutyOption[]) {
  if (choices.length && choices.every(item => keys.includes(item.key))) return "Tutti gli incarichi";
  return choices.filter(item => keys.includes(item.key)).map(item => item.title).join(", ");
}
export function validDutyKey(value: unknown): value is string {
  return typeof value === "string" && (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value) || value === "opening" || value === "closing");
}

// Derived from access to the Forum reception dashboard, never a writable target.
export const REGISTRATION_CHECK_DUTY: DutyOption = { key: "registration_check", title: "Verifica iscrizione", room: null, kind: "verification" };
