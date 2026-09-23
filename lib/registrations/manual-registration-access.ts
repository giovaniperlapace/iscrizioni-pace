export function canCreateOperationsRegistration(
  roles: Array<{ role: string; eventId: string | null }>,
  eventId: string,
): boolean {
  return roles.some(role =>
    role.role === "admin" && role.eventId === null ||
    role.role === "manager" && role.eventId === eventId
  );
}
