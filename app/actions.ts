"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  createPublicRegistration,
  getPublicRegistrationOptions,
  hasExistingRegistrationForEmail,
  sendMagicLinkEmail,
} from "@/lib/registrations/public-flow";
import {
  normalizeEmail,
  parseRegistrationForm,
} from "@/lib/registrations/validation";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const EMAIL_RATE_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 };
const REGISTRATION_RATE_LIMIT = { limit: 3, windowMs: 60 * 60 * 1000 };

export async function startPublicEmailFlow(formData: FormData) {
  const email = normalizeEmail(formData.get("email"));
  const appUrl = getAppUrl();
  const ipAddress = await getIpAddress();

  if (!email) {
    redirect("/?error=email");
  }

  if (!checkRateLimit(`email:${ipAddress}:${email}`, EMAIL_RATE_LIMIT)) {
    redirect("/?error=rate-limit");
  }

  const supabase = createSupabaseServiceClient();
  const { event } = await getPublicRegistrationOptions(supabase);

  if (!event) {
    redirect("/?error=no-event");
  }

  const exists = await hasExistingRegistrationForEmail(supabase, email, event.id);

  if (!exists) {
    redirect(`/registrazione?email=${encodeURIComponent(email)}`);
  }

  try {
    await sendMagicLinkEmail(
      supabase,
      email,
      `${appUrl}/auth/callback?redirect_to=/dashboard/partecipante`
    );
  } catch (error) {
    redirect(
      `/?error=${encodeURIComponent(getPublicEmailErrorMessage(error))}`
    );
  }

  redirect("/?sent=magic-link");
}

export async function submitPublicRegistration(formData: FormData) {
  const parsed = parseRegistrationForm(formData);
  const email = normalizeEmail(formData.get("email"));
  const ipAddress = await getIpAddress();

  if (!parsed.ok) {
    redirect(
      `/registrazione?email=${encodeURIComponent(email)}&error=${encodeURIComponent(
        parsed.errors[0] ?? "invalid"
      )}`
    );
  }

  if (!checkRateLimit(`registration:${ipAddress}:${parsed.value.email}`, REGISTRATION_RATE_LIMIT)) {
    redirect(
      `/registrazione?email=${encodeURIComponent(parsed.value.email)}&error=rate-limit`
    );
  }

  const headerStore = await headers();
  const supabase = createSupabaseServiceClient();

  try {
    await createPublicRegistration(
      supabase,
      parsed.value,
      {
        ipAddress: ipAddress === "local" ? null : ipAddress,
        userAgent: headerStore.get("user-agent"),
      },
      getPublicSiteUrl()
    );
  } catch (error) {
    const message = getPublicRegistrationErrorMessage(error);

    redirect(
      `/registrazione?email=${encodeURIComponent(parsed.value.email)}&error=${encodeURIComponent(
        message
      )}`
    );
  }

  redirect(
    `/registrazione/conferma?email=${encodeURIComponent(parsed.value.email)}`
  );
}

function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function getPublicSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.PUBLIC_SITE_URL ||
    getAppUrl()
  ).replace(/\/$/, "");
}

async function getIpAddress(): Promise<string> {
  const headerStore = await headers();

  return (
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerStore.get("x-real-ip") ||
    "local"
  );
}

function getPublicRegistrationErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";

  if (
    message.includes("Invalid login") ||
    message.includes("BadCredentials") ||
    message.includes("535-5.7.8")
  ) {
    return "L'iscrizione è stata registrata, ma al momento non è possibile inviare l'email di conferma. Riprova l'accesso più tardi o contatta l'organizzazione.";
  }

  return message || "Non è stato possibile completare l'iscrizione.";
}

function getPublicEmailErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";

  if (
    message.includes("Invalid login") ||
    message.includes("BadCredentials") ||
    message.includes("535-5.7.8")
  ) {
    return "Non è stato possibile inviare l'email di accesso: le credenziali del servizio email non sono accettate. Contatta l'organizzazione.";
  }

  return "Non è stato possibile inviare l'email di accesso. Riprova tra poco.";
}
