import {
  ROLE_ROUTES,
  type DashboardRole,
  type EventRole,
} from "./roles.ts";

export type DashboardTabRole = Exclude<DashboardRole, "manager_viewer">;

export type DashboardRoleTab = {
  key: DashboardTabRole;
  label: string;
  href: string;
};

export const ROLE_TAB_ORDER: DashboardTabRole[] = [
  "admin",
  "manager",
  "accoglienza",
  "capogruppo",
  "partecipante",
];

const ROLE_TAB_LABELS: Record<DashboardTabRole, string> = {
  admin: "Dashboard admin",
  manager: "Dashboard manager",
  accoglienza: "Dashboard accoglienza",
  capogruppo: "Dashboard capogruppo",
  partecipante: "Iscrizione e QR personale",
};

export function getDashboardRoleTabs(
  eventRoles: Array<{ role: EventRole; eventId: string | null }>
): DashboardRoleTab[] {
  const available = new Set<DashboardTabRole>(["partecipante"]);
  const hasAdmin = eventRoles.some((role) => role.role === "admin");

  if (hasAdmin) {
    for (const role of ROLE_TAB_ORDER) {
      available.add(role);
    }
  } else {
    for (const eventRole of eventRoles) {
      available.add(normalizeDashboardTabRole(eventRole.role));
    }
  }

  return ROLE_TAB_ORDER.filter((role) => available.has(role)).map((role) => ({
    key: role,
    label: ROLE_TAB_LABELS[role],
    href: ROLE_ROUTES[role],
  }));
}

export function normalizeDashboardTabRole(
  role: DashboardRole | EventRole
): DashboardTabRole {
  return role === "manager_viewer" ? "manager" : role;
}
