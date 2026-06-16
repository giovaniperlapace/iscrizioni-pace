import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  dashboardRoleFromPath,
  isDashboardRole,
  isRoleAllowedForDashboard,
  ROLE_ROUTES,
  type DashboardRole,
} from "@/lib/auth/roles";

type RoleRow = {
  role: string | null;
};

type GroupMembershipRoleRow = {
  role: string | null;
};

function clearSupabaseCookies(request: NextRequest, response: NextResponse) {
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-")) {
      response.cookies.set(cookie.name, "", { path: "/", maxAge: 0 });
    }
  }
}

export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectedFrom", request.nextUrl.pathname);
    response = NextResponse.redirect(loginUrl);
    clearSupabaseCookies(request, response);
    return response;
  }

  const [{ data: eventRoles }, { data: groupMemberships }] = await Promise.all([
    supabase.from("event_user_roles").select("role"),
    supabase.from("group_memberships").select("role"),
  ]);
  const availableRoles = new Set<DashboardRole>(["partecipante"]);

  for (const row of (eventRoles ?? []) as RoleRow[]) {
    if (isDashboardRole(row.role)) {
      availableRoles.add(row.role);
    }
  }

  for (const row of (groupMemberships ?? []) as GroupMembershipRoleRow[]) {
    if (row.role === "capogruppo") {
      availableRoles.add("capogruppo");
    }
  }

  const requestedRoleCookie =
    request.cookies.get("iscrizioni_requested_role")?.value ?? null;
  const requestedRole = isDashboardRole(requestedRoleCookie)
    ? requestedRoleCookie
    : null;

  if (request.nextUrl.pathname === "/dashboard") {
    const role =
      requestedRole && isRoleAllowedForDashboard(requestedRole, availableRoles)
        ? requestedRole
        : pickFirstAllowedDashboard(availableRoles);

    return NextResponse.redirect(new URL(ROLE_ROUTES[role], request.url));
  }

  const requiredRole = dashboardRoleFromPath(request.nextUrl.pathname);

  if (requiredRole && !isRoleAllowedForDashboard(requiredRole, availableRoles)) {
    return NextResponse.redirect(
      new URL(ROLE_ROUTES.partecipante, request.url)
    );
  }

  return response;
}

function pickFirstAllowedDashboard(
  availableRoles: ReadonlySet<DashboardRole>
): DashboardRole {
  const priority: DashboardRole[] = [
    "admin",
    "manager",
    "accoglienza",
    "manager_viewer",
    "capogruppo",
    "partecipante",
  ];

  return (
    priority.find((role) => isRoleAllowedForDashboard(role, availableRoles)) ??
    "partecipante"
  );
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
