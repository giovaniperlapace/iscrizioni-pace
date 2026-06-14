import type { SupabaseClient, User } from "@supabase/supabase-js";

import { pickDashboardRole, type DashboardRole, type EventRole } from "./roles";

export type EventUserRole = {
  role: EventRole;
  eventId: string | null;
};

export type AuthContext = {
  user: User;
  eventRoles: EventUserRole[];
  dashboardRole: DashboardRole;
  dashboardPath: string;
};

type EventUserRoleRow = {
  role: string | null;
  event_id: string | null;
};

export async function getCurrentAuthContext(
  supabase: SupabaseClient,
  requestedRole?: string | null
): Promise<AuthContext | null> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const eventRoles = await getEventRolesForCurrentUser(supabase);
  const dashboardRole = pickDashboardRole(
    eventRoles.map((role) => role.role),
    requestedRole
  );

  return {
    user,
    eventRoles,
    dashboardRole,
    dashboardPath: dashboardPathForRole(dashboardRole),
  };
}

export async function ensureCurrentUserProfile(
  supabase: SupabaseClient,
  user: User
): Promise<void> {
  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : null;

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email ?? null,
      full_name: fullName,
    },
    { onConflict: "id" }
  );

  if (error) {
    throw error;
  }
}

async function getEventRolesForCurrentUser(
  supabase: SupabaseClient
): Promise<EventUserRole[]> {
  const { data, error } = await supabase
    .from("event_user_roles")
    .select("role,event_id");

  if (error || !data) {
    return [];
  }

  return (data as EventUserRoleRow[])
    .filter((row): row is EventUserRoleRow & { role: EventRole } =>
      isKnownEventRole(row.role)
    )
    .map((row) => ({
      role: row.role,
      eventId: row.event_id,
    }));
}

function isKnownEventRole(value: string | null): value is EventRole {
  return (
    value === "admin" ||
    value === "manager" ||
    value === "manager_viewer" ||
    value === "accoglienza" ||
    value === "capogruppo"
  );
}

function dashboardPathForRole(role: DashboardRole): string {
  switch (role) {
    case "admin":
      return "/dashboard/admin";
    case "manager":
    case "manager_viewer":
      return "/dashboard/manager";
    case "accoglienza":
      return "/dashboard/accoglienza";
    case "capogruppo":
      return "/dashboard/capogruppo";
    case "partecipante":
      return "/dashboard/partecipante";
  }
}
