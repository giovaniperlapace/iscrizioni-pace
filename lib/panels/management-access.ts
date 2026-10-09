import type { EventUserRole } from "../auth/session";

// First production acceptance is reserved to global administrators.
// Opening manager access requires an explicit subsequent release (and matching SQL).
export function canAccessPanelManagement(roles: EventUserRole[]): boolean {
  return roles.some(role => role.role === "admin");
}

export function isPanelCampaign(filters: unknown): boolean {
  if (!filters || typeof filters !== "object") return false;
  const value = filters as Record<string, unknown>;
  return value.audience === "teachers" || Boolean(value.panelId) || Boolean(value.schoolName) ||
    [value.subject, value.message, value.subject_template, value.body_template].some(text =>
      typeof text === "string" && /\{\{\s*(?:panel|scuola)\s*\}\}/i.test(text));
}
