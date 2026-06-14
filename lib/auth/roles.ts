export const EVENT_ROLES = [
  "admin",
  "manager",
  "manager_viewer",
  "accoglienza",
  "capogruppo",
] as const;

export type EventRole = (typeof EVENT_ROLES)[number];

export const DASHBOARD_ROLES = [
  ...EVENT_ROLES,
  "partecipante",
] as const;

export type DashboardRole = (typeof DASHBOARD_ROLES)[number];

export const ROLE_ROUTES: Record<DashboardRole, string> = {
  admin: "/dashboard/admin",
  manager: "/dashboard/manager",
  manager_viewer: "/dashboard/manager",
  accoglienza: "/dashboard/accoglienza",
  capogruppo: "/dashboard/capogruppo",
  partecipante: "/dashboard/partecipante",
};

export const ROLE_LABELS: Record<DashboardRole, string> = {
  admin: "Admin",
  manager: "Manager",
  manager_viewer: "Manager viewer",
  accoglienza: "Accoglienza",
  capogruppo: "Capogruppo",
  partecipante: "Partecipante",
};

const ROLE_PRIORITY: DashboardRole[] = [
  "admin",
  "manager",
  "accoglienza",
  "manager_viewer",
  "capogruppo",
  "partecipante",
];

export function isEventRole(value: string | null | undefined): value is EventRole {
  return Boolean(value && EVENT_ROLES.includes(value as EventRole));
}

export function isDashboardRole(
  value: string | null | undefined
): value is DashboardRole {
  return Boolean(value && DASHBOARD_ROLES.includes(value as DashboardRole));
}

export function pickDashboardRole(
  roles: readonly string[],
  requestedRole?: string | null
): DashboardRole {
  const availableRoles = new Set(
    roles.filter((role): role is DashboardRole => isDashboardRole(role))
  );
  availableRoles.add("partecipante");

  if (
    isDashboardRole(requestedRole) &&
    isRoleAllowedForDashboard(requestedRole, availableRoles)
  ) {
    return requestedRole;
  }

  return (
    ROLE_PRIORITY.find((role) => isRoleAllowedForDashboard(role, availableRoles)) ??
    "partecipante"
  );
}

export function isRoleAllowedForDashboard(
  requiredRole: DashboardRole,
  availableRoles: ReadonlySet<DashboardRole>
): boolean {
  if (requiredRole === "partecipante") {
    return true;
  }

  if (availableRoles.has("admin")) {
    return true;
  }

  if (requiredRole === "manager") {
    return availableRoles.has("manager") || availableRoles.has("manager_viewer");
  }

  if (requiredRole === "manager_viewer") {
    return availableRoles.has("manager_viewer") || availableRoles.has("manager");
  }

  return availableRoles.has(requiredRole);
}

export function dashboardRoleFromPath(pathname: string): DashboardRole | null {
  if (pathname === "/dashboard/admin" || pathname.startsWith("/dashboard/admin/")) {
    return "admin";
  }

  if (
    pathname === "/dashboard/manager" ||
    pathname.startsWith("/dashboard/manager/")
  ) {
    return "manager";
  }

  if (
    pathname === "/dashboard/accoglienza" ||
    pathname.startsWith("/dashboard/accoglienza/")
  ) {
    return "accoglienza";
  }

  if (
    pathname === "/dashboard/capogruppo" ||
    pathname.startsWith("/dashboard/capogruppo/")
  ) {
    return "capogruppo";
  }

  if (
    pathname === "/dashboard/partecipante" ||
    pathname.startsWith("/dashboard/partecipante/")
  ) {
    return "partecipante";
  }

  return null;
}
