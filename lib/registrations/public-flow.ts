import type { SupabaseClient } from "@supabase/supabase-js";

import { sendTransactionalEmail } from "@/lib/email/smtp";
import {
  renderMagicLinkEmail,
  renderRegistrationConfirmationEmail,
} from "@/lib/email/templates";
import {
  normalizeMatchText,
  resolveGroupAssignmentForRegistration,
  type GroupAgeBracket,
  type GroupCommunityKind,
  type GroupMatchCandidate,
  type GroupNodeType,
} from "@/lib/groups/matching";
import {
  getGroupRegistrationDisplayLabel,
  getGroupRegistrationLinkStatus,
  hashGroupRegistrationLinkToken,
  isValidGroupRegistrationLinkToken,
} from "@/lib/groups/registration-links";
import {
  buildRegistrationQuestionnaireAnswers,
  getQuestionnaireVisibilitySummary,
  REGISTRATION_QUESTIONNAIRE_VERSION,
} from "@/lib/questionnaire/registration";
import { renderQrPngBuffer } from "@/lib/qrcode/render";
import { encryptQrToken } from "@/lib/qrcode/secure-token";
import { createOpaqueQrToken } from "@/lib/qrcode/token";
import { buildAppMagicLink } from "@/lib/registrations/magic-link";
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

type PublicCountryRow = {
  id: string;
  name_it: string;
  name_en: string;
};

type PublicCityRow = {
  id: string;
  country_id: string;
  name: string;
};

type PublicGroupRow = {
  id: string;
  name: string;
  public_label: string | null;
  primary_leader_name: string | null;
  country_id: string | null;
  city_id: string | null;
  parent_group_id: string | null;
  node_type: string | null;
  community_kind: string | null;
  age_bracket: string | null;
  is_assignable: boolean | null;
  is_public_catalog: boolean | null;
  public_order: number | null;
};

type PublicGroupRegistrationLinkRow = {
  id: string;
  event_id: string;
  group_id: string;
  public_label: string | null;
  max_uses: number | null;
  use_count: number | null;
  expires_at: string | null;
  revoked_at: string | null;
  groups: PublicGroupRow | PublicGroupRow[] | null;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type PublicRegistrationOptions = {
  event: PublicEvent | null;
  countries: Array<{ id: string; name_it: string; name_en: string }>;
  cities: Array<{ id: string; country_id: string; name: string }>;
  groups: Array<{
    id: string;
    name: string;
    publicLabel: string | null;
    primaryLeaderName: string | null;
    countryId: string | null;
    cityId: string | null;
    parentGroupId: string | null;
    nodeType: GroupNodeType;
    communityKind: GroupCommunityKind;
    ageBracket: GroupAgeBracket;
    isAssignable: boolean;
    isPublicCatalog: boolean;
    publicOrder: number;
  }>;
  groupLink: {
    id: string;
    groupId: string;
    groupName: string;
    displayLabel: string;
  } | null;
  moments: Array<{ id: string; title: string; starts_at: string | null }>;
};

export async function getPublicRegistrationOptions(
  supabase: SupabaseClient,
  groupRegistrationLinkToken?: string | null
): Promise<PublicRegistrationOptions> {
  const event = await getCurrentPublicEvent(supabase);
  const groupLink = event
    ? await resolveActiveGroupRegistrationLink(
        supabase,
        event.id,
        groupRegistrationLinkToken ?? null
      )
    : null;

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
          .select(
            "id,name,public_label,primary_leader_name,country_id,city_id,parent_group_id,node_type,community_kind,age_bracket,is_assignable,is_public_catalog,public_order"
          )
          .eq("event_id", event.id)
          .eq("is_active", true)
          .eq("is_public_catalog", true)
          .eq("is_assignable", true)
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
    groups: ((groups.data ?? []) as PublicGroupRow[]).map(mapGroupRow),
    groupLink: groupLink
      ? {
          id: groupLink.id,
          groupId: groupLink.group.id,
          groupName: groupLink.group.name,
          displayLabel: groupLink.displayLabel,
        }
      : null,
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

  const geography = await resolveParticipantGeography(supabase, input);

  const { data: participant, error: participantError } = await supabase
    .from("participants")
    .insert({
      first_name: input.firstName,
      last_name: input.lastName,
      birth_date: input.birthDate,
      preferred_locale: input.preferredLocale,
      country_id: geography.countryId,
      city_id: geography.cityId,
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
  const groups = await getEventGroupCandidates(supabase, event.id);
  const groupLink = await resolveActiveGroupRegistrationLink(
    supabase,
    event.id,
    input.groupRegistrationLinkToken
  );
  const selectedGroupId = resolveAllowedSelectedGroupId({
    groups,
    requestedGroupId: input.groupId,
    groupLink,
  });
  const groupAssignment = resolveGroupAssignmentForRegistration({
    groups,
    criteria: {
      countryId: geography.countryId,
      cityId: geography.cityId,
      birthDate: input.birthDate,
      eventStartsOn: event.starts_on,
    },
    selectedGroupId,
    hasPreviousSantegidioParticipation: input.hasPreviousSantegidioParticipation,
    participatesWithGroup: input.participatesWithGroup,
    cannotFindLeader: input.cannotFindLeader,
  });
  const resolvedGroupAssignment = groupLink
    ? {
        groupId: groupLink.group.id,
        source: "participant_selected" as const,
        confidence: 0.95,
        reason: "group_registration_link",
        matcherVersion: GROUP_REGISTRATION_LINK_MATCHER_VERSION,
      }
    : groupAssignment;

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
      token_encrypted: encryptQrToken(qrToken.token),
    }),
    supabase.from("audit_logs").insert({
      event_id: event.id,
      action: "registration.created",
      entity_table: "registrations",
      entity_id: registrationId,
      metadata: {
        source: "public_form",
        privacy_version: PRIVACY_VERSION,
        group_registration_link_id: groupLink?.id ?? null,
      },
    }),
  ];

  if (resolvedGroupAssignment) {
    writes.push(
      supabase.from("participant_group_assignments").insert({
        registration_id: registrationId,
        group_id: resolvedGroupAssignment.groupId,
        status: "probable",
        source: resolvedGroupAssignment.source,
        confidence: resolvedGroupAssignment.confidence,
        assignment_reason: resolvedGroupAssignment.reason,
        matcher_version: resolvedGroupAssignment.matcherVersion,
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

  if (groupLink) {
    await Promise.all([
      supabase
        .from("group_registration_links")
        .update({ use_count: groupLink.useCount + 1 })
        .eq("id", groupLink.id),
      supabase.from("audit_logs").insert({
        event_id: event.id,
        action: "registration.group_link_used",
        entity_table: "group_registration_links",
        entity_id: groupLink.id,
        metadata: {
          registration_id: registrationId,
          group_id: groupLink.group.id,
        },
      }),
    ]);
  }

  try {
    const qrCodeContentId = `registration-qr-${registrationId}@iscrizioni-pace`;
    const qrCodePng = await renderQrPngBuffer(qrToken.token);

    await sendTransactionalEmail({
      to: input.email,
      ...renderRegistrationConfirmationEmail({
        firstName: input.firstName,
        lastName: input.lastName,
        participantCode: createdParticipant.public_code,
        eventTitle: event.title,
        siteLink: publicSiteUrl,
        qrCodeContentId,
      }),
      attachments: [
        {
          filename: `qr-${createdParticipant.public_code}.png`,
          content: qrCodePng,
          contentType: "image/png",
          cid: qrCodeContentId,
        },
      ],
    });
  } catch (error) {
    await supabase.from("audit_logs").insert({
      event_id: event.id,
      action: "email.registration_confirmation_failed",
      entity_table: "registrations",
      entity_id: registrationId,
      metadata: {
        email_domain: input.email.split("@")[1]?.toLowerCase() ?? null,
        message:
          error instanceof Error
            ? error.message.slice(0, 300)
            : "Errore email sconosciuto",
      },
    });
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

async function resolveParticipantGeography(
  supabase: SupabaseClient,
  input: RegistrationInput
): Promise<{ countryId: string | null; cityId: string | null }> {
  const countryId =
    input.countryId ??
    (input.countryOther
      ? await findCountryIdByName(supabase, input.countryOther)
      : null);
  const cityId =
    input.cityId ??
    (countryId && input.cityOther
      ? await findCityIdByName(supabase, countryId, input.cityOther)
      : null);

  return { countryId, cityId };
}

async function findCountryIdByName(
  supabase: SupabaseClient,
  countryName: string
): Promise<string | null> {
  const { data } = await supabase
    .from("countries")
    .select("id,name_it,name_en")
    .eq("is_active", true);

  const normalizedCountry = normalizeMatchText(countryName);
  const match = ((data ?? []) as PublicCountryRow[]).find(
    (country) =>
      normalizeMatchText(country.name_it) === normalizedCountry ||
      normalizeMatchText(country.name_en) === normalizedCountry
  );

  return match?.id ?? null;
}

async function findCityIdByName(
  supabase: SupabaseClient,
  countryId: string,
  cityName: string
): Promise<string | null> {
  const { data } = await supabase
    .from("cities")
    .select("id,country_id,name")
    .eq("country_id", countryId)
    .eq("is_active", true);

  const normalizedCity = normalizeMatchText(cityName);
  const match = ((data ?? []) as PublicCityRow[]).find(
    (city) => normalizeMatchText(city.name) === normalizedCity
  );

  return match?.id ?? null;
}

async function getEventGroupCandidates(
  supabase: SupabaseClient,
  eventId: string
): Promise<GroupMatchCandidate[]> {
  const { data, error } = await supabase
    .from("groups")
    .select(
      "id,name,public_label,primary_leader_name,country_id,city_id,parent_group_id,node_type,community_kind,age_bracket,is_assignable,is_public_catalog,public_order"
    )
    .eq("event_id", eventId)
    .eq("is_active", true);

  if (error) {
    throw error;
  }

  return ((data ?? []) as PublicGroupRow[]).map(mapGroupRow);
}

function mapGroupRow(row: PublicGroupRow): GroupMatchCandidate {
  return {
    id: row.id,
    name: row.name,
    publicLabel: row.public_label,
    primaryLeaderName: row.primary_leader_name,
    countryId: row.country_id,
    cityId: row.city_id,
    parentGroupId: row.parent_group_id,
    nodeType: parseNodeType(row.node_type),
    communityKind: parseCommunityKind(row.community_kind),
    ageBracket: parseAgeBracket(row.age_bracket),
    isAssignable: row.is_assignable ?? true,
    isPublicCatalog: row.is_public_catalog ?? true,
    publicOrder: row.public_order ?? 100,
  };
}

const GROUP_REGISTRATION_LINK_MATCHER_VERSION = "2026-06-17-group-link-v1";

type ResolvedGroupRegistrationLink = {
  id: string;
  group: ReturnType<typeof mapGroupRow>;
  displayLabel: string;
  useCount: number;
};

async function resolveActiveGroupRegistrationLink(
  supabase: SupabaseClient,
  eventId: string,
  token: string | null
): Promise<ResolvedGroupRegistrationLink | null> {
  if (!token) {
    return null;
  }

  if (!isValidGroupRegistrationLinkToken(token)) {
    throw new Error("Link gruppo non valido o non più attivo.");
  }

  const { data, error } = await supabase
    .from("group_registration_links")
    .select(
      "id,event_id,group_id,public_label,max_uses,use_count,expires_at,revoked_at,groups!inner(id,name,public_label,primary_leader_name,country_id,city_id,parent_group_id,node_type,community_kind,age_bracket,is_assignable,is_public_catalog,public_order)"
    )
    .eq("event_id", eventId)
    .eq("token_hash", hashGroupRegistrationLinkToken(token))
    .maybeSingle();

  if (error || !data) {
    throw new Error("Link gruppo non valido o non più attivo.");
  }

  const link = data as PublicGroupRegistrationLinkRow;
  const groupRow = relatedOne(link.groups);

  if (!groupRow) {
    throw new Error("Link gruppo non valido o non più attivo.");
  }

  const group = mapGroupRow(groupRow);
  const status = getGroupRegistrationLinkStatus({
    expiresAt: link.expires_at,
    revokedAt: link.revoked_at,
    maxUses: link.max_uses,
    useCount: link.use_count,
  });

  if (status !== "active" || !group.isAssignable) {
    throw new Error("Link gruppo non valido o non più attivo.");
  }

  return {
    id: link.id,
    group,
    displayLabel: getGroupRegistrationDisplayLabel({
      linkPublicLabel: link.public_label,
      groupPublicLabel: group.publicLabel,
    }),
    useCount: link.use_count ?? 0,
  };
}

function resolveAllowedSelectedGroupId({
  groups,
  requestedGroupId,
  groupLink,
}: {
  groups: GroupMatchCandidate[];
  requestedGroupId: string | null;
  groupLink: ResolvedGroupRegistrationLink | null;
}): string | null {
  if (groupLink) {
    return groupLink.group.id;
  }

  if (!requestedGroupId) {
    return null;
  }

  const group = groups.find((candidate) => candidate.id === requestedGroupId);

  if (!group || !group.isAssignable || !group.isPublicCatalog) {
    throw new Error("Il gruppo selezionato non è disponibile nel form pubblico.");
  }

  return requestedGroupId;
}

function relatedOne<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function parseNodeType(value: string | null): GroupNodeType {
  return value === "country" ||
    value === "city" ||
    value === "area" ||
    value === "newcomers"
    ? value
    : "group";
}

function parseCommunityKind(value: string | null): GroupCommunityKind {
  return value === "newcomers" || value === "territorial"
    ? value
    : "santegidio";
}

function parseAgeBracket(value: string | null): GroupAgeBracket {
  return value === "giovani" || value === "adulti" || value === "both"
    ? value
    : "none";
}
