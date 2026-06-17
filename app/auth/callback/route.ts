import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import {
  ensureCurrentUserProfile,
  getCurrentAuthContext,
} from "@/lib/auth/session";
import { isDashboardRole } from "@/lib/auth/roles";
import { linkParticipantsToUserByEmail } from "@/lib/registrations/public-flow";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

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
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash =
    requestUrl.searchParams.get("token_hash") ?? requestUrl.searchParams.get("token");
  const otpType = requestUrl.searchParams.get("type");
  const requestedRole = requestUrl.searchParams.get("role");
  const redirectTo = requestUrl.searchParams.get("redirect_to");

  const supabase = await createSupabaseServerClient();
  let verificationError: unknown = null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      verificationError = error;
    }
  } else if (tokenHash && isOtpType(otpType)) {
    for (const verificationType of getOtpTypesToTry(otpType)) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: verificationType,
      });

      if (!error) {
        verificationError = null;
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
  const response = NextResponse.redirect(responseUrl);

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
  return NextResponse.redirect(loginUrl);
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
