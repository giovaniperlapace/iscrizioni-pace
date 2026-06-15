"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentAuthContext } from "@/lib/auth/session";
import {
  canParticipantEditRegistration,
  diffParticipantDashboardUpdate,
  parseParticipantDashboardUpdate,
} from "@/lib/registrations/participant-dashboard";
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
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

export async function updateParticipantDashboard(formData: FormData) {
  const parsed = parseParticipantDashboardUpdate(formData);

  if (!parsed.ok) {
    redirect(
      `/dashboard/partecipante?error=${encodeURIComponent(
        parsed.errors[0] ?? "invalid"
      )}`
    );
  }

  const supabase = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(supabase, "partecipante");

  if (!auth) {
    redirect("/login");
  }

  const { data: registration, error: registrationError } = await supabase
    .from("registrations")
    .select(
      "id,event_id,participant_id,status,events(registration_closes_at),participants!inner(auth_user_id,preferred_locale)"
    )
    .eq("id", parsed.value.registrationId)
    .maybeSingle();

  if (registrationError || !registration) {
    redirect("/dashboard/partecipante?error=not-found");
  }

  const rawRegistration = registration as unknown as {
    id: string;
    event_id: string;
    participant_id: string;
    status: string | null;
    events: Array<{ registration_closes_at: string | null }> | null;
    participants:
      | Array<{ auth_user_id: string | null; preferred_locale: string | null }>
      | null;
  };
  const registrationRow = {
    id: rawRegistration.id,
    event_id: rawRegistration.event_id,
    participant_id: rawRegistration.participant_id,
    status: rawRegistration.status,
    events: rawRegistration.events?.[0] ?? null,
    participants: rawRegistration.participants?.[0] ?? null,
  };

  if (registrationRow.participants?.auth_user_id !== auth.user.id) {
    redirect("/dashboard/partecipante?error=not-found");
  }

  if (!canParticipantEditRegistration(registrationRow)) {
    redirect("/dashboard/partecipante?error=closed");
  }

  const [
    { data: contacts },
    { data: attendanceChoices },
    { data: momentChoices },
    { data: accessibility },
  ] = await Promise.all([
    supabase
      .from("participant_contacts")
      .select("id,phone,is_primary")
      .eq("participant_id", registrationRow.participant_id)
      .order("is_primary", { ascending: false })
      .limit(1),
    supabase
      .from("event_attendance_choices")
      .select("day,choice")
      .eq("registration_id", registrationRow.id),
    supabase
      .from("moment_attendance_choices")
      .select("moment_id,choice")
      .eq("registration_id", registrationRow.id),
    supabase
      .from("accessibility_needs")
      .select("washington_group_answers,needs_operational_support,operational_notes")
      .eq("registration_id", registrationRow.id)
      .maybeSingle(),
  ]);

  const primaryContact = contacts?.[0] as
    | { id: string; phone: string | null }
    | undefined;
  const previousMomentChoices = Object.fromEntries(
    ((momentChoices ?? []) as Array<{ moment_id: string; choice: string }>).map(
      (choice) => [choice.moment_id, choice.choice]
    )
  );
  const previousAvailabilityDays = ((attendanceChoices ?? []) as Array<{
    day: string | null;
    choice: string;
  }>)
    .filter((choice) => choice.choice === "yes" && choice.day)
    .map((choice) => choice.day as string);
  const previousAvailabilityUnknown = ((attendanceChoices ?? []) as Array<{
    day: string | null;
    choice: string;
  }>).some((choice) => choice.choice === "unknown");
  const previousAccessibility = accessibility as
    | {
        washington_group_answers: Record<string, boolean> | null;
        needs_operational_support: boolean | null;
        operational_notes: string | null;
      }
    | null;
  const changedFields = diffParticipantDashboardUpdate(
    {
      phone: primaryContact?.phone ?? null,
      preferredLocale: registrationRow.participants?.preferred_locale ?? "it",
      availabilityDays: previousAvailabilityDays,
      availabilityUnknown: previousAvailabilityUnknown,
      momentAttendanceChoices: previousMomentChoices,
      accessibilityAnswers: previousAccessibility?.washington_group_answers ?? {},
      needsOperationalSupport: previousAccessibility?.needs_operational_support ?? false,
      accessibilityNotes: previousAccessibility?.operational_notes ?? null,
    },
    parsed.value
  );

  const writes = [
    supabase
      .from("participants")
      .update({ preferred_locale: parsed.value.preferredLocale })
      .eq("id", registrationRow.participant_id),
    supabase
      .from("accessibility_needs")
      .upsert(
        {
          registration_id: registrationRow.id,
          washington_group_answers: parsed.value.accessibilityAnswers,
          needs_operational_support: parsed.value.needsOperationalSupport,
          operational_notes: parsed.value.accessibilityNotes,
        },
        { onConflict: "registration_id" }
      ),
    supabase
      .from("event_attendance_choices")
      .delete()
      .eq("registration_id", registrationRow.id),
    supabase
      .from("moment_attendance_choices")
      .delete()
      .eq("registration_id", registrationRow.id),
  ];

  if (primaryContact) {
    writes.push(
      supabase
        .from("participant_contacts")
        .update({ phone: parsed.value.phone })
        .eq("id", primaryContact.id)
    );
  } else if (parsed.value.phone) {
    writes.push(
      supabase.from("participant_contacts").insert({
        participant_id: registrationRow.participant_id,
        phone: parsed.value.phone,
        is_primary: true,
      })
    );
  }

  const writeResults = await Promise.all(writes);
  const failedWrite = writeResults.find((result) => result.error);

  if (failedWrite?.error) {
    redirect(
      `/dashboard/partecipante?error=${encodeURIComponent(
        failedWrite.error.message
      )}`
    );
  }

  const attendanceRows = parsed.value.availabilityUnknown
    ? [{ registration_id: registrationRow.id, choice: "unknown" }]
    : parsed.value.availabilityDays.map((day) => ({
        registration_id: registrationRow.id,
        day,
        choice: "yes",
      }));
  const momentRows = Object.entries(parsed.value.momentAttendanceChoices).map(
    ([momentId, choice]) => ({
      registration_id: registrationRow.id,
      moment_id: momentId,
      choice,
    })
  );
  const insertResults = await Promise.all([
    attendanceRows.length > 0
      ? supabase.from("event_attendance_choices").insert(attendanceRows)
      : Promise.resolve({ error: null }),
    momentRows.length > 0
      ? supabase.from("moment_attendance_choices").insert(momentRows)
      : Promise.resolve({ error: null }),
  ]);
  const failedInsert = insertResults.find((result) => result.error);

  if (failedInsert?.error) {
    redirect(
      `/dashboard/partecipante?error=${encodeURIComponent(
        failedInsert.error.message
      )}`
    );
  }

  if (changedFields.length > 0) {
    const serviceSupabase = createSupabaseServiceClient();

    await serviceSupabase.from("audit_logs").insert({
      event_id: registrationRow.event_id,
      actor_user_id: auth.user.id,
      action: "participant.dashboard_updated",
      entity_table: "registrations",
      entity_id: registrationRow.id,
      metadata: {
        changed_fields: changedFields,
      },
    });
  }

  revalidatePath("/dashboard/partecipante");
  redirect("/dashboard/partecipante?saved=1");
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
