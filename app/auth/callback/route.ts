import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import {
  ensureCurrentUserProfile,
  getCurrentAuthContext,
} from "@/lib/auth/session";
import { isDashboardRole } from "@/lib/auth/roles";
import { LAST_ACTIVITY_COOKIE, SESSION_STATE_MAX_AGE_SECONDS } from "@/lib/auth/session-persistence";
import { linkParticipantsToUserByEmail } from "@/lib/registrations/public-flow";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { MAGIC_LINK_RESPONSE_HEADERS, renderMagicLinkConfirmation } from "@/lib/auth/magic-link-confirmation";
import { LOCALE_COOKIE_NAME, normalizeLocale, pickLocaleFromAcceptLanguage } from "@/lib/i18n/config";

const OTP_TYPES = [
  "signup",
  "magiclink",
  "recovery",
  "invite",
  "email",
  "email_change",
] as const;

function isOtpType(value: string | null): value is EmailOtpType {
  return Boolean(value && OTP_TYPES.includes(value as (typeof OTP_TYPES)[number]));
}

function getOtpTypesToTry(otpType: EmailOtpType): EmailOtpType[] {
  if (otpType === "magiclink") {
    return ["magiclink", "email"];
  }

  return [otpType];
}

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  if (params.get("code") || params.get("token_hash") || params.get("token")) {
    const locale = normalizeLocale(request.cookies.get(LOCALE_COOKIE_NAME)?.value)
      ?? pickLocaleFromAcceptLanguage(request.headers.get("accept-language"));
    return new NextResponse(renderMagicLinkConfirmation(params, locale), {
      headers: { ...MAGIC_LINK_RESPONSE_HEADERS, "Content-Type": "text/html; charset=utf-8" },
    });
  }
  return redirectWithError(new URL(request.url), "session");
}

export async function POST(request: NextRequest) {
  // Prevent a third-party site from submitting a login on someone's behalf.
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return new NextResponse(null, { status: 403, headers: MAGIC_LINK_RESPONSE_HEADERS });
  }
  if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) {
    return new NextResponse(null, { status: 415, headers: MAGIC_LINK_RESPONSE_HEADERS });
  }
  const body = await request.text();
  if (body.length > 8192) return new NextResponse(null, { status: 413, headers: MAGIC_LINK_RESPONSE_HEADERS });
  const params = new URLSearchParams(body);
  if (!params.get("code") && !(params.get("token_hash") || params.get("token"))) {
    return redirectWithError(new URL(request.url), "session");
  }
  const response = await completeAuthentication(request, params);
  for (const [name, value] of Object.entries(MAGIC_LINK_RESPONSE_HEADERS)) response.headers.set(name, value);
  return response;
}

async function completeAuthentication(request: NextRequest, params: URLSearchParams) {
  const requestUrl = new URL(request.url);
  const code = params.get("code");
  const tokenHash =
    params.get("token_hash") ?? params.get("token");
  const otpType = params.get("type");
  const requestedRole = params.get("role");
  const redirectTo = params.get("redirect_to");

  const supabase = await createSupabaseServerClient();
  let verificationError: unknown = null;
  let freshlyAuthenticated = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      verificationError = error;
    } else {
      freshlyAuthenticated = true;
    }
  } else if (tokenHash && isOtpType(otpType)) {
    for (const verificationType of getOtpTypesToTry(otpType)) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: verificationType,
      });

      if (!error) {
        verificationError = null;
        freshlyAuthenticated = true;
        break;
      }

      verificationError = error;
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    logAuthCallbackIssue(requestUrl, verificationError ? "verification" : "session", {
      code: Boolean(code),
      tokenHash: Boolean(tokenHash),
      otpType,
      requestedRole,
      message: errorMessage(verificationError),
    });

    if (verificationError && code) {
      return redirectWithError(requestUrl, "code");
    }

    if (verificationError) {
      return redirectWithError(requestUrl, "otp");
    }

    return redirectWithError(requestUrl, "session");
  }

  if (verificationError) {
    logAuthCallbackIssue(requestUrl, "verification_ignored_with_session", {
      code: Boolean(code),
      tokenHash: Boolean(tokenHash),
      otpType,
      requestedRole,
      message: errorMessage(verificationError),
    });
  }

  try {
    await ensureCurrentUserProfile(supabase, user);
    if (user.email) {
      await linkParticipantsToUserByEmail(
        createSupabaseServiceClient(),
        user.id,
        user.email
      );
    }
  } catch (error) {
    logAuthCallbackIssue(requestUrl, "profile", {
      requestedRole,
      message: errorMessage(error),
    });
    return redirectWithError(requestUrl, "profile");
  }

  const authContext = await getCurrentAuthContext(
    supabase,
    isDashboardRole(requestedRole) ? requestedRole : null
  );

  if (!authContext) {
    logAuthCallbackIssue(requestUrl, "auth_context", { requestedRole });
    return redirectWithError(requestUrl, "session");
  }

  const responseUrl = new URL(
    sanitizeRedirectPath(redirectTo) ?? authContext.dashboardPath,
    requestUrl.origin
  );
  const response = NextResponse.redirect(responseUrl, 303);

  // A valid new login starts a new inactivity window before the dashboard's
  // proxy sees the request. An old session or a failed link must not renew it.
  if (freshlyAuthenticated) {
    response.cookies.set(LAST_ACTIVITY_COOKIE, String(Date.now()), {
      httpOnly: true,
      maxAge: SESSION_STATE_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  if (isDashboardRole(requestedRole)) {
    response.cookies.set("iscrizioni_requested_role", requestedRole, {
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      sameSite: "lax",
    });
  }

  return response;
}

function redirectWithError(requestUrl: URL, reason: string): NextResponse {
  const loginUrl = new URL("/login", requestUrl.origin);
  loginUrl.searchParams.set("error", reason);
  return NextResponse.redirect(loginUrl, 303);
}

function sanitizeRedirectPath(path: string | null): string | null {
  if (!path?.startsWith("/")) {
    return null;
  }

  if (path.startsWith("//")) {
    return null;
  }

  return path;
}

function logAuthCallbackIssue(
  requestUrl: URL,
  reason: string,
  metadata: Record<string, unknown>
) {
  console.warn(
    "auth.callback.issue",
    JSON.stringify({
      reason,
      path: requestUrl.pathname,
      ...metadata,
    })
  );
}

function errorMessage(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}
