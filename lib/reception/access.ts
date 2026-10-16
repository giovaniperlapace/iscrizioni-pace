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
