import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import {
  hasSessionBeenInactive,
  LAST_ACTIVITY_COOKIE,
  LAST_DASHBOARD_COOKIE,
  sanitizeLastDashboardPath,
  SESSION_STATE_MAX_AGE_SECONDS,
} from "@/lib/auth/session-persistence";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return expiredResponse();
  }

  if (
    hasSessionBeenInactive(cookieStore.get(LAST_ACTIVITY_COOKIE)?.value)
  ) {
    await supabase.auth.signOut();
    return expiredResponse();
  }

  const input = (await request.json().catch(() => null)) as {
    path?: unknown;
  } | null;
  const dashboardPath = sanitizeLastDashboardPath(
    typeof input?.path === "string" ? input.path : null
  );
  const response = new NextResponse(null, { status: 204 });

  setSessionCookie(response, LAST_ACTIVITY_COOKIE, String(Date.now()));

  if (dashboardPath) {
    setSessionCookie(response, LAST_DASHBOARD_COOKIE, dashboardPath);
  }

  return response;
}

function expiredResponse() {
  const response = NextResponse.json(
    { error: "session_inactive" },
    { status: 401 }
  );

  clearSessionCookies(response);
  return response;
}

function setSessionCookie(
  response: NextResponse,
  name: string,
  value: string
) {
  response.cookies.set(name, value, {
    httpOnly: true,
    maxAge: SESSION_STATE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

function clearSessionCookies(response: NextResponse) {
  for (const name of [LAST_ACTIVITY_COOKIE, LAST_DASHBOARD_COOKIE]) {
    response.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
}
