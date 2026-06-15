import type { SupabaseClient } from "@supabase/supabase-js";

import { sendTransactionalEmail } from "@/lib/email/smtp";
import {
  renderMagicLinkEmail,
  renderRegistrationConfirmationEmail,
} from "@/lib/email/templates";
import {
  buildRegistrationQuestionnaireAnswers,
  getQuestionnaireVisibilitySummary,
  REGISTRATION_QUESTIONNAIRE_VERSION,
} from "@/lib/questionnaire/registration";
import { createOpaqueQrToken } from "@/lib/qrcode/token";
import {
  PRIVACY_VERSION,
  type RegistrationInput,
} from "@/lib/registrations/validation";

type PublicEvent = {
  id: string;
  title: string;
  city: string;
  country: string;
  starts_on: string | null;
  ends_on: string | null;
};

type ExistingContactRow = {
  participant_id: string;
};

type CreatedParticipant = {
  id: string;
  public_code: string;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type PublicRegistrationOptions = {
  event: PublicEvent | null;
  countries: Array<{ id: string; name_it: string; name_en: string }>;
  cities: Array<{ id: string; country_id: string; name: string }>;
  groups: Array<{
    id: string;
    name: string;
    primary_leader_name: string | null;
  }>;
  moments: Array<{ id: string; title: string; starts_at: string | null }>;
};

export async function getPublicRegistrationOptions(
  supabase: SupabaseClient
): Promise<PublicRegistrationOptions> {
  const event = await getCurrentPublicEvent(supabase);

  const [countries, cities, groups, moments] = await Promise.all([
    supabase
      .from("countries")
      .select("id,name_it,name_en")
      .eq("is_active", true)
      .order("name_it"),
    supabase
      .from("cities")
      .select("id,country_id,name")
      .eq("is_active", true)
      .order("name"),
    event
      ? supabase
          .from("groups")
          .select("id,name,primary_leader_name")
          .eq("event_id", event.id)
          .eq("is_active", true)
          .order("name")
      : Promise.resolve({ data: [], error: null }),
    event
      ? supabase
          .from("event_moments")
          .select("id,title,starts_at")
          .eq("event_id", event.id)
          .eq("is_public", true)
          .order("starts_at")
      : Promise.resolve({ data: [], error: null }),
  ]);

  return {
    event,
    countries: countries.data ?? [],
    cities: cities.data ?? [],
    groups: groups.data ?? [],
    moments: moments.data ?? [],
  };
}

export async function hasExistingRegistrationForEmail(
  supabase: SupabaseClient,
  email: string,
  eventId: string
): Promise<boolean> {
  const { data: contacts, error: contactError } = await supabase
    .from("participant_contacts")
    .select("participant_id")
    .eq("email", email)
    .limit(25);

  if (contactError || !contacts?.length) {
    return false;
  }

  const participantIds = (contacts as ExistingContactRow[]).map(
    (contact) => contact.participant_id
  );

  const { data: registrations, error: registrationError } = await supabase
    .from("registrations")
    .select("id")
    .eq("event_id", eventId)
    .in("participant_id", participantIds)
    .neq("status", "cancelled")
    .limit(1);

  return !registrationError && Boolean(registrations?.length);
}

export async function sendMagicLinkEmail(
  supabase: SupabaseClient,
  email: string,
  redirectTo: string
): Promise<void> {
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo,
    },
  });

  const actionLink = data.properties?.action_link;
  const hashedToken = data.properties?.hashed_token;

  if (error || (!actionLink && !hashedToken)) {
    throw error ?? new Error("Supabase did not return a magic link");
  }

  await sendTransactionalEmail({
    to: email,
    ...renderMagicLinkEmail({
      actionLink:
        buildAppMagicLink(redirectTo, hashedToken ?? null) ?? actionLink ?? "",
    }),
  });
}

export async function createPublicRegistration(
  supabase: SupabaseClient,
  input: RegistrationInput,
  requestMeta: { ipAddress: string | null; userAgent: string | null },
  publicSiteUrl: string
): Promise<{ registrationId: string; qrToken: string }> {
  const event = await getCurrentPublicEvent(supabase);

  if (!event) {
    throw new Error("Nessun evento pubblicato accetta iscrizioni in questo momento.");
  }

  if (await hasExistingRegistrationForEmail(supabase, input.email, event.id)) {
    throw new Error("Questa email risulta già iscritta all'evento.");
  }

  const { data: participant, error: participantError } = await supabase
    .from("participants")
    .insert({
      first_name: input.firstName,
      last_name: input.lastName,
      birth_date: input.birthDate,
      preferred_locale: input.preferredLocale,
      country_id: input.countryId,
      city_id: input.cityId,
      country_other: input.countryOther,
      city_other: input.cityOther,
      has_previous_santegidio_participation:
        input.hasPreviousSantegidioParticipation,
      participates_with_group: input.participatesWithGroup,
    })
    .select("id,public_code")
    .single();

  if (participantError || !participant) {
    throw participantError ?? new Error("Impossibile creare il partecipante.");
  }

  const createdParticipant = participant as CreatedParticipant;

  const { error: contactError } = await supabase
    .from("participant_contacts")
    .insert({
      participant_id: createdParticipant.id,
      email: input.email,
      phone: input.phone,
      is_primary: true,
    });

  if (contactError) {
    throw contactError;
  }

  const { data: registration, error: registrationError } = await supabase
    .from("registrations")
    .insert({
      event_id: event.id,
      participant_id: createdParticipant.id,
      source: "public_form",
    })
    .select("id")
    .single();

  if (registrationError || !registration) {
    throw registrationError ?? new Error("Impossibile creare l'iscrizione.");
  }

  const registrationId = registration.id;
  const qrToken = createOpaqueQrToken();
  const allowedEventDays = getEventDayValues(event.starts_on, event.ends_on);

  if (
    !input.availabilityUnknown &&
    input.availabilityDays.some((day) => !allowedEventDays.has(day))
  ) {
    throw new Error("I giorni di presenza selezionati non appartengono all'evento.");
  }

  const writes = [
    supabase.from("participant_consents").insert({
      registration_id: registrationId,
      privacy_version: PRIVACY_VERSION,
      privacy_accepted_at: new Date().toISOString(),
      data_processing_accepted: input.dataProcessingAccepted,
      accepted_by_name: `${input.firstName} ${input.lastName}`.trim(),
      ip_address: requestMeta.ipAddress,
      user_agent: requestMeta.userAgent,
    }),
    supabase.from("accessibility_needs").insert({
      registration_id: registrationId,
      washington_group_answers: input.accessibilityAnswers,
      operational_notes: input.accessibilityNotes,
      needs_operational_support: input.needsOperationalSupport,
    }),
    supabase.from("registration_questionnaire_answers").insert({
      registration_id: registrationId,
      event_id: event.id,
      questionnaire_version: REGISTRATION_QUESTIONNAIRE_VERSION,
      answers: buildRegistrationQuestionnaireAnswers(input),
      visibility_summary: getQuestionnaireVisibilitySummary(),
    }),
    supabase.from("qr_tokens").insert({
      registration_id: registrationId,
      token_hash: qrToken.tokenHash,
    }),
    supabase.from("audit_logs").insert({
      event_id: event.id,
      action: "registration.created",
      entity_table: "registrations",
      entity_id: registrationId,
      metadata: {
        source: "public_form",
        privacy_version: PRIVACY_VERSION,
      },
    }),
  ];

  if (input.groupId) {
    writes.push(
      supabase.from("participant_group_assignments").insert({
        registration_id: registrationId,
        group_id: input.groupId,
        status: "probable",
        source: "participant_selected",
        confidence: 0.8,
      })
    );
  }

  const attendanceChoices: Array<{
    registration_id: string;
    day?: string;
    choice: "yes" | "no" | "unknown";
  }> = input.availabilityUnknown
    ? [{ registration_id: registrationId, choice: "unknown" }]
    : input.availabilityDays.map((day) => ({
        registration_id: registrationId,
        day,
        choice: "yes",
      }));

  if (attendanceChoices.length > 0) {
    writes.push(supabase.from("event_attendance_choices").insert(attendanceChoices));
  }

  const momentChoices = Object.entries(input.momentAttendanceChoices).map(
    ([momentId, choice]) => ({
      registration_id: registrationId,
      moment_id: momentId,
      choice,
    })
  );

  if (momentChoices.length > 0) {
    writes.push(supabase.from("moment_attendance_choices").insert(momentChoices));
  }

  const results = await Promise.all(writes);
  const failedWrite = results.find((result) => result.error);

  if (failedWrite?.error) {
    throw failedWrite.error;
  }

  try {
    await sendTransactionalEmail({
      to: input.email,
      ...renderRegistrationConfirmationEmail({
        firstName: input.firstName,
        lastName: input.lastName,
        participantCode: createdParticipant.public_code,
        eventTitle: event.title,
        siteLink: publicSiteUrl,
      }),
    });
  } catch (error) {
    console.error("[email:registration-confirmation]", error);
  }

  return { registrationId, qrToken: qrToken.token };
}

export async function linkParticipantsToUserByEmail(
  supabase: SupabaseClient,
  userId: string,
  email: string
): Promise<void> {
  const { data: contacts, error } = await supabase
    .from("participant_contacts")
    .select("participant_id")
    .eq("email", email)
    .limit(50);

  if (error || !contacts?.length) {
    return;
  }

  const participantIds = (contacts as ExistingContactRow[]).map(
    (contact) => contact.participant_id
  );

  await supabase
    .from("participants")
    .update({ auth_user_id: userId })
    .in("id", participantIds)
    .is("auth_user_id", null);
}

async function getCurrentPublicEvent(
  supabase: SupabaseClient
): Promise<PublicEvent | null> {
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("events")
    .select("id,title,city,country,starts_on,ends_on")
    .eq("status", "published")
    .or(`registration_opens_at.is.null,registration_opens_at.lte.${now}`)
    .or(`registration_closes_at.is.null,registration_closes_at.gte.${now}`)
    .order("starts_on", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

function getEventDayValues(
  startsOn: string | null,
  endsOn: string | null
): Set<string> {
  if (!startsOn) {
    return new Set();
  }

  const start = parseDateOnly(startsOn);
  const end = parseDateOnly(endsOn ?? startsOn);

  if (!start || !end || end.getTime() < start.getTime()) {
    return new Set();
  }

  const days = new Set<string>();

  for (
    let cursor = start;
    cursor.getTime() <= end.getTime();
    cursor = new Date(cursor.getTime() + DAY_IN_MS)
  ) {
    days.add(cursor.toISOString().slice(0, 10));
  }

  return days;
}

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  );
}

function buildAppMagicLink(
  redirectTo: string,
  hashedToken: string | null
): string | null {
  if (!hashedToken) {
    return null;
  }

  const callbackUrl = new URL(redirectTo);
  callbackUrl.searchParams.set("token_hash", hashedToken);
  callbackUrl.searchParams.set("type", "magiclink");

  return callbackUrl.toString();
}
