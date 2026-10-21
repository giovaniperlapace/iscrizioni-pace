import { hasPanelReceptionDuty } from "@/lib/reception/duties.server";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  dashboardRoleFromPath,
  isDashboardRole,
  isRoleAllowedForDashboard,
  pickDashboardRole,
  ROLE_ROUTES,
  type DashboardRole,
} from "@/lib/auth/roles";
import {
  hasSessionBeenInactive,
  LAST_ACTIVITY_COOKIE,
  LAST_DASHBOARD_COOKIE,
  sanitizeLastDashboardPath,
  SESSION_STATE_MAX_AGE_SECONDS,
} from "@/lib/auth/session-persistence";

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

function clearAppSessionCookies(response: NextResponse) {
  for (const name of [
    LAST_ACTIVITY_COOKIE,
    LAST_DASHBOARD_COOKIE,
    "iscrizioni_requested_role",
  ]) {
    response.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
}

export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next();
  }

  const response = NextResponse.next({
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
    if (
      request.nextUrl.pathname === "/" ||
      request.nextUrl.pathname === "/login"
    ) {
      return response;
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectedFrom", request.nextUrl.pathname);
    const loginResponse = redirectPreservingCookies(loginUrl, response);
    clearSupabaseCookies(request, loginResponse);
    clearAppSessionCookies(loginResponse);
    return loginResponse;
  }

  if (
    hasSessionBeenInactive(
      request.cookies.get(LAST_ACTIVITY_COOKIE)?.value
    )
  ) {
    await supabase.auth.signOut();
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "inactive");
    const loginResponse = redirectPreservingCookies(loginUrl, response);
    clearSupabaseCookies(request, loginResponse);
    clearAppSessionCookies(loginResponse);
    return loginResponse;
  }

  const [{ data: eventRoles }, { data: groupMemberships }, hasReceptionAssignments] = await Promise.all([
    supabase.from("event_user_roles").select("role").eq("user_id", user.id),
    supabase.from("group_memberships").select("role").eq("user_id", user.id),
    hasPanelReceptionDuty(supabase),
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
  const defaultRole =
    requestedRole && isRoleAllowedForDashboard(requestedRole, availableRoles, hasReceptionAssignments)
      ? requestedRole
      : pickFirstAllowedDashboard(availableRoles, hasReceptionAssignments);

  if (
    request.nextUrl.pathname === "/" ||
    request.nextUrl.pathname === "/login"
  ) {
    const rememberedPath = sanitizeLastDashboardPath(
      request.cookies.get(LAST_DASHBOARD_COOKIE)?.value
    );
    const rememberedRole = rememberedPath
      ? dashboardRoleFromPath(new URL(rememberedPath, request.url).pathname)
      : null;
    const destination =
      rememberedPath &&
      rememberedRole &&
      isRoleAllowedForDashboard(rememberedRole, availableRoles, hasReceptionAssignments)
        ? rememberedPath
        : ROLE_ROUTES[defaultRole];
    const redirectResponse = redirectPreservingCookies(
      new URL(destination, request.url),
      response
    );
    rememberActivity(redirectResponse, destination);
    return redirectResponse;
  }

  if (request.nextUrl.pathname === "/dashboard") {
    const destination = ROLE_ROUTES[defaultRole];
    const redirectResponse = redirectPreservingCookies(
      new URL(destination, request.url),
      response
    );
    rememberActivity(redirectResponse, destination);
    return redirectResponse;
  }

  const requiredRole = dashboardRoleFromPath(request.nextUrl.pathname);
  // Managers may train before assigning themselves an operational duty.
  // The training page still verifies the current-event manager scope server-side.
  const managerReceptionDemo = request.nextUrl.pathname === "/dashboard/accoglienza-forum-eventi/collaudo" && availableRoles.has("manager");

  if (requiredRole && !managerReceptionDemo && !isRoleAllowedForDashboard(requiredRole, availableRoles, hasReceptionAssignments)) {
    const destination = ROLE_ROUTES[defaultRole];
    const redirectResponse = redirectPreservingCookies(
      new URL(destination, request.url),
      response
    );
    rememberActivity(redirectResponse, destination);
    return redirectResponse;
  }

  rememberActivity(
    response,
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  );
  return response;
}

function redirectPreservingCookies(url: URL, source: NextResponse) {
  const redirectResponse = NextResponse.redirect(url);

  for (const cookie of source.cookies.getAll()) {
    redirectResponse.cookies.set(cookie);
  }

  return redirectResponse;
}

function rememberActivity(response: NextResponse, rawPath: string) {
  const path = sanitizeLastDashboardPath(rawPath);
  const options = {
    httpOnly: true,
    maxAge: SESSION_STATE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };

  response.cookies.set(LAST_ACTIVITY_COOKIE, String(Date.now()), options);

  if (path) {
    response.cookies.set(LAST_DASHBOARD_COOKIE, path, options);
  }
}

function pickFirstAllowedDashboard(
  availableRoles: ReadonlySet<DashboardRole>,
  hasReceptionAssignments = false
): DashboardRole {
  return pickDashboardRole([...availableRoles], null, hasReceptionAssignments);
}

export const config = {
  matcher: ["/", "/login", "/dashboard/:path*"],
};
