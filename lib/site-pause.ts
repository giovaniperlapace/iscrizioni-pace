/** Build-time switch shared by browser and server. Reopening requires a new build. */
export function isSitePaused(): boolean {
  return process.env.NEXT_PUBLIC_SITE_PAUSED !== "false";
}

export function canAccessPausedSite(roles: readonly { role: string | null; event_id: string | null }[], currentEventId: string | null): boolean {
  return roles.some(row =>
    (row.role === "admin" && row.event_id === null) ||
    (row.role === "manager" && currentEventId !== null && row.event_id === currentEventId)
  );
}
