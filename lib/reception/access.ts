// Roles are cumulative. Only the current event's reception role grants access;
// Manager alone, an assignment or a participant tag does not grant this capability.
export function canOperateReception(
  roles: readonly { role: string; event_id: string | null }[],
  eventId: string,
): boolean {
  return roles.some(role =>
    (role.role === "admin" && role.event_id === null) ||
    (role.role === "accoglienza" && role.event_id === eventId));
}

// This capability is limited to one registration in the participant sheet.
export function canOperateParticipantReception(
  roles: readonly { role: string; event_id: string | null }[], eventId: string,
): boolean {
  return canOperateReception(roles, eventId) || roles.some(role => role.role === "manager" && role.event_id === eventId);
}
