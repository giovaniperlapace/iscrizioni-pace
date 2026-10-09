import type { EventUserRole } from "../auth/session";

// Without an event ID this is only a role preflight; loaders must check the
// resolved current event before reading operational panel data.
export function canAccessPanelManagement(roles: EventUserRole[], eventId?: string | null): boolean {
  return roles.some(role => (role.role === "admin" && role.eventId === null) ||
    (role.role === "manager" && Boolean(role.eventId) &&
      (eventId === undefined || role.eventId === eventId)));
}

export function isPanelCampaign(filters: unknown): boolean {
  if (!filters || typeof filters !== "object") return false;
  const value = filters as Record<string, unknown>;
  return value.audience === "teachers" || Boolean(value.panelId) || Boolean(value.schoolName) ||
    [value.subject, value.message, value.subject_template, value.body_template].some(text =>
      typeof text === "string" && /\{\{\s*(?:panel|scuola)\s*\}\}/i.test(text));
}
