export const LAST_ACTIVITY_COOKIE = "iscrizioni_last_activity";
export const LAST_DASHBOARD_COOKIE = "iscrizioni_last_dashboard";
export const SESSION_IDLE_TIMEOUT_MS = 24 * 60 * 60 * 1000;
export const SESSION_STATE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const ADMIN_SECTIONS = new Set([
  "evento",
  "servizi",
  "impostazioni",
  "dashboard",
  "iscritti",
  "ruoli",
  "gruppi",
]);
const MANAGER_SECTIONS = new Set([
  "dashboard",
  "iscritti",
  "servizi",
  "impostazioni",
  "email",
  "ruoli",
  "gruppi",
]);

export function hasSessionBeenInactive(
  lastActivity: string | null | undefined,
  now = Date.now()
): boolean {
  if (!lastActivity) {
    return false;
  }

  const timestamp = Number(lastActivity);

  return (
    !Number.isFinite(timestamp) ||
    timestamp <= 0 ||
    now - timestamp >= SESSION_IDLE_TIMEOUT_MS
  );
}

export function sanitizeLastDashboardPath(
  value: string | null | undefined
): string | null {
  if (!value?.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  let url: URL;

  try {
    url = new URL(value, "https://session.local");
  } catch {
    return null;
  }

  if (url.origin !== "https://session.local") {
    return null;
  }

  if (
    url.pathname === "/dashboard/partecipante" ||
    url.pathname === "/dashboard/capogruppo" ||
    url.pathname === "/dashboard/accoglienza"
  ) {
    return url.pathname;
  }

  if (
    url.pathname !== "/dashboard/admin" &&
    url.pathname !== "/dashboard/manager"
  ) {
    return null;
  }

  const allowedSections =
    url.pathname === "/dashboard/admin" ? ADMIN_SECTIONS : MANAGER_SECTIONS;
  const params = new URLSearchParams();
  const section = url.searchParams.get("section");
  const nav = url.searchParams.get("nav");

  if (section && allowedSections.has(section)) {
    params.set("section", section);
  }

  if (nav === "mini") {
    params.set("nav", nav);
  }

  const query = params.toString();
  return query ? `${url.pathname}?${query}` : url.pathname;
}
