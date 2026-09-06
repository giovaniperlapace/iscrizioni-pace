"use server";

import { operationsReturnPath } from "@/lib/registrations/operations-table";

import { formFailureFromRedirect, formFailure, issueFromMessage, validateContactFields } from "@/lib/forms/result";

import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentAuthContext, type EventUserRole } from "@/lib/auth/session";
import {
  LAST_ACTIVITY_COOKIE,
  LAST_DASHBOARD_COOKIE,
} from "@/lib/auth/session-persistence";
import {
  collectDescendantGroupIds,
  normalizeLeaderInternalNote,
  type GroupTreeNode,
} from "@/lib/groups/capogruppo-dashboard";
import {
  isValidGroupRegistrationLinkToken,
  hashGroupRegistrationLinkToken,
  isReservedGroupRegistrationLinkToken,
  normalizeGroupRegistrationPublicLabel,
} from "@/lib/groups/registration-links";
import {
  canParticipantEditRegistration,
  diffParticipantDashboardUpdate,
  parseParticipantDashboardUpdate,
  preserveAccessibilityUnlessEdited,
  preserveChildrenUnlessEdited,
} from "@/lib/registrations/participant-dashboard";
import { toRegistrationChildRows } from "@/lib/registrations/registration-children";
import {
  buildManualRegistrationQuestionnaireAnswers,
  parseManualRegistrationForm,
} from "@/lib/registrations/manual-registration";
import {
  createPublicRegistration,
  getPublicRegistrationOptions,
  hasExistingAppAccessForEmail,
  hasExistingRegistrationForEmail,
  sendMagicLinkEmail,
} from "@/lib/registrations/public-flow";
import {
  normalizeEmail,
  parseRegistrationForm,
  PRIVACY_VERSION,
} from "@/lib/registrations/validation";
import {
  normalizeOperationalTagColor,
  normalizeOperationalTagLabel,
} from "@/lib/registrations/operational-tags";
import {
  isEventServiceDescriptionWithinLimit,
  isEventServiceLabelWithinLimit,
  normalizeEventServiceCatalogDescription,
  normalizeEventServiceDescription,
  normalizeEventServiceLabel,
  normalizeEventServiceOrder,
  parseParticipantEventServiceStatus,
} from "@/lib/registrations/event-services";
import { syncOperationalIdentityByEmail } from "@/lib/operational-users/identity";
import { getCurrentOperationalEventId } from "@/lib/events/current";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { REGISTRATION_QUESTIONNAIRE_VERSION } from "@/lib/questionnaire/registration";
import { getQuestionnaireVisibilitySummary } from "@/lib/questionnaire/registration";
import { encryptQrToken } from "@/lib/qrcode/secure-token";
import { createOpaqueQrToken } from "@/lib/qrcode/token";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  normalizeLocale,
} from "@/lib/i18n/config";
import {
  attendanceSlotKey,
  buildAllowedAttendanceSlotKeys,
} from "@/lib/registrations/attendance-slots";

const EMAIL_RATE_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 };
const REGISTRATION_RATE_LIMIT = { limit: 3, windowMs: 60 * 60 * 1000 };
const MAGIC_LINK_SEND_COOLDOWN_MS = 60 * 1000;

type OperationsGroupRow = {
  id: string;
  event_id: string;
  community_kind: string | null;
  age_brackets: string[] | null;
  is_assignable: boolean | null;
  is_public_catalog: boolean | null;
  is_active: boolean | null;
  public_order: number | null;
};

export async function setAppLocale(formData: FormData) {
  const locale = normalizeLocale(String(formData.get("locale") ?? "")) ?? DEFAULT_LOCALE;
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE_NAME, locale, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  const returnTo = normalizeInternalReturnTo(formData.get("returnTo"));
  revalidatePath(returnTo.split("?")[0] || "/");
  redirect(returnTo);
}

export async function logout() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete(LAST_ACTIVITY_COOKIE);
  cookieStore.delete(LAST_DASHBOARD_COOKIE);
  cookieStore.delete("iscrizioni_requested_role");

  redirect("/");
}

function normalizeInternalReturnTo(value: FormDataEntryValue | null): string {
  const text = String(value ?? "").trim();

  if (!text.startsWith("/") || text.startsWith("//")) {
    return "/";
  }

  return text;
}

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

  const exists = await hasExistingAppAccessForEmail(supabase, email, event.id);

  if (!exists) {
    redirect(`/registrazione?email=${encodeURIComponent(email)}`);
  }

  const emailHash = hashEmailForAudit(email);

  if (await hasRecentMagicLinkSend(supabase, event.id, emailHash)) {
    redirect("/?sent=magic-link");
  }

  try {
    await sendMagicLinkEmail(
      supabase,
      email,
      `${appUrl}/auth/callback?redirect_to=/dashboard/partecipante`
    );
    await logMagicLinkSent(supabase, event.id, emailHash);
  } catch (error) {
    await logEmailFailure(supabase, {
      eventId: event.id,
      action: "email.magic_link_failed",
      email,
      error,
    });

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
  const sessionSupabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sessionSupabase.auth.getUser();
  const authUserId =
    user?.email?.toLowerCase() === parsed.value.email.toLowerCase()
      ? user.id
      : null;

  try {
    await createPublicRegistration(
      supabase,
      parsed.value,
      {
        ipAddress: ipAddress === "local" ? null : ipAddress,
        userAgent: headerStore.get("user-agent"),
      },
      getPublicSiteUrl(),
      authUserId
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
  const contactIssues = validateContactFields(formData);
  if (contactIssues.length) return formFailure(contactIssues);
  const parsed = parseParticipantDashboardUpdate(formData);
  const updatesAccessibility = formData.get("updatesAccessibility") === "on";
  const updatesChildren = formData.get("updatesChildren") === "on";

  if (!parsed.ok) {
    return formFailure(parsed.errors.map(issueFromMessage));
  }

  const supabase = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(supabase, "partecipante");

  if (!auth) {
    redirect("/login");
  }

  const { data: registration, error: registrationError } = await supabase
    .from("registrations")
    .select(
      "id,event_id,participant_id,status,events(starts_on,ends_on,registration_closes_at),participants!inner(auth_user_id,first_name,last_name)"
    )
    .is("deleted_at", null)
    .eq("id", parsed.value.registrationId)
    .maybeSingle();

  if (registrationError || !registration) {
    return formFailureFromRedirect("/dashboard/partecipante?error=not-found");
  }

  const rawRegistration = registration as unknown as {
    id: string;
    event_id: string;
    participant_id: string;
    status: string | null;
    events:
      | Array<{
          starts_on: string | null;
          ends_on: string | null;
          registration_closes_at: string | null;
        }>
      | null;
    participants:
      | Array<{
          auth_user_id: string | null;
          first_name: string;
          last_name: string;
        }>
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
    return formFailureFromRedirect("/dashboard/partecipante?error=not-found");
  }

  if (!canParticipantEditRegistration(registrationRow)) {
    return formFailureFromRedirect("/dashboard/partecipante?error=closed");
  }

  const allowedAttendanceSlots = buildAllowedAttendanceSlotKeys(
    registrationRow.events?.starts_on ?? null,
    registrationRow.events?.ends_on ?? null
  );

  if (
    !parsed.value.availabilityUnknown &&
    parsed.value.availabilitySlots.some(
      (slot) => !allowedAttendanceSlots.has(attendanceSlotKey(slot))
    )
  ) {
    return formFailureFromRedirect("/dashboard/partecipante?error=invalid-days");
  }

  const [
    { data: contacts },
    { data: attendanceChoices },
    { data: momentChoices },
    { data: accessibility },
    { data: children },
  ] = await Promise.all([
    supabase
      .from("participant_contacts")
      .select("id,phone,is_primary")
      .eq("participant_id", registrationRow.participant_id)
      .order("is_primary", { ascending: false })
      .limit(1),
    supabase
      .from("event_attendance_choices")
      .select("day,day_part,choice")
      .eq("registration_id", registrationRow.id),
    supabase
      .from("moment_attendance_choices")
      .select("moment_id,choice")
      .eq("registration_id", registrationRow.id),
    supabase
      .from("accessibility_needs")
      .select("washington_group_answers,needs_operational_support")
      .eq("registration_id", registrationRow.id)
      .maybeSingle(),
    supabase
      .from("registration_children")
      .select("first_name,last_name,birth_date,position")
      .eq("registration_id", registrationRow.id)
      .order("position"),
  ]);

  const primaryContact = contacts?.[0] as
    | { id: string; phone: string | null }
    | undefined;
  const previousMomentChoices = Object.fromEntries(
    ((momentChoices ?? []) as Array<{ moment_id: string; choice: string }>).map(
      (choice) => [choice.moment_id, choice.choice]
    )
  );
  const previousAvailabilitySlots = ((attendanceChoices ?? []) as Array<{
    day: string | null;
    day_part: "morning" | "afternoon" | null;
    choice: string;
  }>)
    .filter((choice) => choice.choice === "yes" && choice.day)
    .flatMap((choice) =>
      choice.day_part
        ? [{ day: choice.day as string, part: choice.day_part }]
        : (["morning", "afternoon"] as const).map((part) => ({
            day: choice.day as string,
            part,
          }))
    );
  const previousAvailabilityUnknown = ((attendanceChoices ?? []) as Array<{
    day: string | null;
    choice: string;
  }>).some((choice) => choice.choice === "unknown");
  const previousAccessibility = accessibility as
    | {
        washington_group_answers: Record<string, boolean> | null;
        needs_operational_support: boolean | null;
      }
    | null;
  const previousChildren = ((children ?? []) as Array<{
    first_name: string;
    last_name: string;
    birth_date: string;
  }>).map((child) => ({
    firstName: child.first_name,
    lastName: child.last_name,
    birthDate: child.birth_date,
  }));
  const dashboardUpdate = preserveChildrenUnlessEdited(
    preserveAccessibilityUnlessEdited(
      parsed.value,
      {
        accessibilityAnswers: previousAccessibility?.washington_group_answers ?? {},
        needsOperationalSupport:
          previousAccessibility?.needs_operational_support ?? false,
      },
      updatesAccessibility
    ),
    previousChildren,
    updatesChildren
  );
  const changedFields = diffParticipantDashboardUpdate(
    {
      firstName: registrationRow.participants?.first_name ?? "",
      lastName: registrationRow.participants?.last_name ?? "",
      phone: primaryContact?.phone ?? null,
      availabilitySlots: previousAvailabilitySlots,
      availabilityUnknown: previousAvailabilityUnknown,
      momentAttendanceChoices: previousMomentChoices,
      children: previousChildren,
      accessibilityAnswers: previousAccessibility?.washington_group_answers ?? {},
      needsOperationalSupport: previousAccessibility?.needs_operational_support ?? false,
    },
    dashboardUpdate
  );

  const writes: Array<PromiseLike<{ error: { message: string } | null }>> = [
    supabase
      .from("accessibility_needs")
      .upsert(
        {
          registration_id: registrationRow.id,
          washington_group_answers: dashboardUpdate.accessibilityAnswers,
          needs_operational_support: dashboardUpdate.needsOperationalSupport,
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

  if (dashboardUpdate.updatesIdentity) {
    writes.push(
      supabase
        .from("participants")
        .update({
          first_name: dashboardUpdate.firstName,
          last_name: dashboardUpdate.lastName,
        })
        .eq("id", registrationRow.participant_id)
    );
  }

  if (primaryContact) {
    writes.push(
      supabase
        .from("participant_contacts")
        .update({ phone: dashboardUpdate.phone })
        .eq("id", primaryContact.id)
    );
  } else if (dashboardUpdate.phone) {
    writes.push(
      supabase.from("participant_contacts").insert({
        participant_id: registrationRow.participant_id,
        phone: dashboardUpdate.phone,
        is_primary: true,
      })
    );
  }

  if (updatesChildren) {
    writes.push(
      supabase
        .from("registration_children")
        .delete()
        .eq("registration_id", registrationRow.id)
    );
  }

  const writeResults = await Promise.all(writes);
  const failedWrite = writeResults.find((result) => result.error);

  if (failedWrite?.error) {
    return formFailureFromRedirect(`/dashboard/partecipante?error=${encodeURIComponent(
        failedWrite.error.message
      )}`);
  }

  const attendanceRows = dashboardUpdate.availabilityUnknown
    ? [{ registration_id: registrationRow.id, choice: "unknown" }]
    : dashboardUpdate.availabilitySlots.map((slot) => ({
        registration_id: registrationRow.id,
        day: slot.day,
        day_part: slot.part,
        choice: "yes",
      }));
  const momentRows = Object.entries(dashboardUpdate.momentAttendanceChoices).map(
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
    updatesChildren && dashboardUpdate.children.length > 0
      ? supabase
          .from("registration_children")
          .insert(
            toRegistrationChildRows(
              registrationRow.id,
              dashboardUpdate.children
            )
          )
      : Promise.resolve({ error: null }),
  ]);
  const failedInsert = insertResults.find((result) => result.error);

  if (failedInsert?.error) {
    return formFailureFromRedirect(`/dashboard/partecipante?error=${encodeURIComponent(
        failedInsert.error.message
      )}`);
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

export async function updateEventOpeningState(formData: FormData) {
  const eventId = optionalText(formData.get("eventId"));
  const intent = optionalText(formData.get("intent"));
  const dashboardPath = "/dashboard/admin?section=impostazioni";

  if (!eventId || !intent) {
    return formFailureFromRedirect(`${dashboardPath}&openingError=invalid`);
  }

  const supabase = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(supabase);

  if (!auth) {
    redirect("/login");
  }

  const canManageEventOpening = auth.eventRoles.some(
    (role) => role.role === "admin"
  );

  if (!canManageEventOpening) {
    return formFailureFromRedirect(`${dashboardPath}&openingError=forbidden`);
  }

  const serviceSupabase = createSupabaseServiceClient();
  const { data: event, error: eventError } = await serviceSupabase
    .from("events")
    .select("id,status,registration_opens_at,registration_closes_at")
    .eq("id", eventId)
    .maybeSingle();

  if (eventError || !event) {
    return formFailureFromRedirect(`${dashboardPath}&openingError=not-found`);
  }

  const now = new Date().toISOString();
  const updates = getEventOpeningUpdate(intent, event, now);

  if (!updates) {
    return formFailureFromRedirect(`${dashboardPath}&openingError=invalid`);
  }

  const { error: updateError } = await serviceSupabase
    .from("events")
    .update(updates)
    .eq("id", eventId);

  if (updateError) {
    return formFailureFromRedirect(`${dashboardPath}&openingError=${encodeURIComponent(updateError.message)}`);
  }

  await serviceSupabase.from("audit_logs").insert({
    event_id: eventId,
    actor_user_id: auth.user.id,
    action: `event.opening_${intent}`,
    entity_table: "events",
    entity_id: eventId,
    metadata: {
      previous_status: event.status,
      previous_registration_opens_at: event.registration_opens_at,
      previous_registration_closes_at: event.registration_closes_at,
      updates,
    },
  });

  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/manager");
  redirect(`${dashboardPath}&openingSaved=1`);
}

export async function setCurrentOperationalEvent(formData: FormData) {
  const eventId = optionalText(formData.get("eventId"));

  if (!eventId) {
    return formFailureFromRedirect("/dashboard/admin?section=impostazioni&openingError=invalid");
  }

  const supabase = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(supabase, "admin");

  if (!auth || !auth.eventRoles.some((role) => role.role === "admin")) {
    redirect("/login");
  }

  const serviceSupabase = createSupabaseServiceClient();
  const { data: event, error: eventError } = await serviceSupabase
    .from("events")
    .select("id,is_current")
    .eq("id", eventId)
    .maybeSingle();
  const eventRow = event as { id: string; is_current: boolean | null } | null;

  if (eventError || !eventRow) {
    return formFailureFromRedirect("/dashboard/admin?section=impostazioni&openingError=not-found");
  }

  if (!eventRow.is_current) {
    const { error: clearError } = await serviceSupabase
      .from("events")
      .update({ is_current: false })
      .eq("is_current", true);

    if (clearError) {
      return formFailureFromRedirect(`/dashboard/admin?section=impostazioni&openingError=${encodeURIComponent(clearError.message)}`);
    }

    const { error: setError } = await serviceSupabase
      .from("events")
      .update({ is_current: true })
      .eq("id", eventRow.id);

    if (setError) {
      return formFailureFromRedirect(`/dashboard/admin?section=impostazioni&openingError=${encodeURIComponent(setError.message)}`);
    }
  }

  await serviceSupabase.from("audit_logs").insert({
    event_id: eventRow.id,
    actor_user_id: auth.user.id,
    action: "event.set_current",
    entity_table: "events",
    entity_id: eventRow.id,
    metadata: {
      previous_is_current: eventRow.is_current,
    },
  });

  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/manager");
  revalidatePath("/dashboard/capogruppo");
  redirect("/dashboard/admin?section=impostazioni&openingSaved=1");
}

export async function createFutureEvent(formData: FormData) {
  const title = optionalText(formData.get("title"));
  const slug = normalizeEventSlug(formData.get("slug"));
  const city = optionalText(formData.get("city"));
  const country = optionalText(formData.get("country"));
  const startsOn = optionalDateOnly(formData.get("startsOn"));
  const endsOn = optionalDateOnly(formData.get("endsOn"));
  const registrationOpensAt = optionalDateTimeLocal(formData.get("registrationOpensAt"));
  const registrationClosesAt = optionalDateTimeLocal(formData.get("registrationClosesAt"));

  if (!title || !slug || !city || !country) {
    return formFailureFromRedirect("/dashboard/admin?section=impostazioni&eventTool=new&openingError=invalid");
  }

  if (startsOn && endsOn && endsOn < startsOn) {
    return formFailure([{ field: "endsOn", code: "date" }]);
  }

  if (
    registrationOpensAt &&
    registrationClosesAt &&
    new Date(registrationClosesAt).getTime() < new Date(registrationOpensAt).getTime()
  ) {
    return formFailure([{ field: "registrationClosesAt", code: "date" }]);
  }

  const supabase = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(supabase, "admin");

  if (!auth || !auth.eventRoles.some((role) => role.role === "admin")) {
    redirect("/login");
  }

  const serviceSupabase = createSupabaseServiceClient();
  const { data: event, error } = await serviceSupabase
    .from("events")
    .insert({
      slug,
      title,
      city,
      country,
      starts_on: startsOn,
      ends_on: endsOn,
      status: "draft",
      registration_opens_at: registrationOpensAt,
      registration_closes_at: registrationClosesAt,
      is_current: false,
    })
    .select("id")
    .single();

  if (error || !event) {
    return formFailureFromRedirect(`/dashboard/admin?section=impostazioni&eventTool=new&openingError=${encodeURIComponent(
        error?.message ?? "create"
      )}`);
  }

  const eventRow = event as { id: string };
  await serviceSupabase.from("audit_logs").insert({
    event_id: eventRow.id,
    actor_user_id: auth.user.id,
    action: "event.created",
    entity_table: "events",
    entity_id: eventRow.id,
    metadata: {
      status: "draft",
      is_current: false,
    },
  });

  revalidatePath("/dashboard/admin");
  redirect("/dashboard/admin?section=impostazioni&openingSaved=created");
}

export async function updateGroupLeaderAssignment(formData: FormData) {
  const assignmentId = optionalText(formData.get("assignmentId"));
  const intent = optionalText(formData.get("intent"));
  const hasLeaderInternalNote = formData.has("leaderInternalNote");
  const note = hasLeaderInternalNote
    ? normalizeLeaderInternalNote(formData.get("leaderInternalNote"))
    : null;

  if (!assignmentId || (intent !== "note" && intent !== "reject")) {
    return formFailureFromRedirect("/dashboard/capogruppo?error=invalid");
  }

  const supabase = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(supabase, "capogruppo");

  if (!auth || auth.dashboardRole !== "capogruppo") {
    redirect("/login");
  }

  const serviceSupabase = createSupabaseServiceClient();
  const currentEventId = await getCurrentOperationalEventId(serviceSupabase);
  if (!currentEventId) {
    return formFailureFromRedirect("/dashboard/capogruppo?error=scope");
  }
  const { data: memberships, error: membershipError } = await serviceSupabase
    .from("group_memberships")
    .select("group_id")
    .eq("user_id", auth.user.id)
    .eq("role", "capogruppo");

  if (membershipError || !memberships?.length) {
    return formFailureFromRedirect("/dashboard/capogruppo?error=scope");
  }

  const rootGroupIds = (memberships as Array<{ group_id: string | null }>)
    .map((membership) => membership.group_id)
    .filter((groupId): groupId is string => Boolean(groupId));
  const { data: groups, error: groupsError } = await serviceSupabase
    .from("groups")
    .select("id,parent_group_id")
    .eq("event_id", currentEventId)
    .eq("is_active", true);

  if (groupsError) {
    return formFailureFromRedirect("/dashboard/capogruppo?error=groups");
  }

  const groupNodes = ((groups ?? []) as Array<{
    id: string;
    parent_group_id: string | null;
  }>).map<GroupTreeNode>((group) => ({
    id: group.id,
    parentGroupId: group.parent_group_id,
  }));
  const scopedGroupIds = collectDescendantGroupIds(groupNodes, rootGroupIds);
  const { data: assignment, error: assignmentError } = await serviceSupabase
    .from("participant_group_assignments")
    .select("id,registration_id,group_id,status,is_current")
    .eq("id", assignmentId)
    .maybeSingle();

  const assignmentRow = assignment as
    | {
        id: string;
        registration_id: string;
        group_id: string;
        status: string | null;
        is_current: boolean | null;
      }
    | null;

  if (
    assignmentError ||
    !assignmentRow ||
    !scopedGroupIds.has(assignmentRow.group_id)
  ) {
    return formFailureFromRedirect("/dashboard/capogruppo?error=not-found");
  }

  if (!assignmentRow.is_current) {
    return formFailureFromRedirect("/dashboard/capogruppo?error=not-found");
  }
  const now = new Date().toISOString();

  if (intent === "note") {
    const updates = {
      leader_internal_note: note,
      leader_note_updated_by: auth.user.id,
      leader_note_updated_at: now,
    };

    const { data: updated, error } = await serviceSupabase
      .from("participant_group_assignments")
      .update(updates)
      .eq("id", assignmentRow.id)
      .eq("is_current", true)
      .select("id")
      .maybeSingle();

    if (error || !updated) {
      return formFailureFromRedirect(`/dashboard/capogruppo?error=${encodeURIComponent(error?.message ?? "not-found")}`);
    }

    await auditGroupLeaderDecision(serviceSupabase, {
      actorUserId: auth.user.id,
      assignment: assignmentRow,
      action: `group_leader.assignment_${intent}`,
      metadata: {
        note_changed: intent === "note",
      },
    });

    revalidatePath("/dashboard/capogruppo");
    redirect("/dashboard/capogruppo?saved=1");
  }

  if (intent === "reject") {
    const { error } = await serviceSupabase.rpc("reject_group_assignment", {
      p_assignment_id: assignmentRow.id,
      p_actor_user_id: auth.user.id,
      p_note: note,
      p_update_note: hasLeaderInternalNote,
    });
    if (error) {
      console.error("[capogruppo:reject-assignment]", error.code);
      return formFailureFromRedirect("/dashboard/capogruppo?error=save");
    }
    revalidatePath("/dashboard/capogruppo");
    revalidatePath("/dashboard/manager");
    revalidatePath("/dashboard/admin");
    redirect("/dashboard/capogruppo?saved=1");
  }

  return formFailureFromRedirect("/dashboard/capogruppo?error=invalid");
}

export async function updateGroupLeaderParticipantContact(formData: FormData) {
  const contactIssues = validateContactFields(formData);
  if (contactIssues.length) return formFailure(contactIssues);
  const assignmentId = optionalText(formData.get("assignmentId"));
  const participantId = optionalText(formData.get("participantId"));
  const email = normalizeEmail(formData.get("email"));
  const phone = normalizeGroupLeaderContactPhone(formData.get("phone"));
  const firstName = optionalText(formData.get("firstName"));
  const lastName = optionalText(formData.get("lastName"));
  const birthDate = normalizeDateOnly(formData.get("birthDate"));
  const city = optionalText(formData.get("city"));
  const country = optionalText(formData.get("country"));
  const hasIdentityUpdate =
    formData.has("firstName") ||
    formData.has("lastName") ||
    formData.has("birthDate") ||
    formData.has("city") ||
    formData.has("country");

  if (!assignmentId || !participantId || (!email && !phone && !hasIdentityUpdate)) {
    return formFailureFromRedirect("/dashboard/capogruppo?error=invalid");
  }

  const supabase = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(supabase, "capogruppo");

  if (!auth || auth.dashboardRole !== "capogruppo") {
    redirect("/login");
  }

  const serviceSupabase = createSupabaseServiceClient();
  const canUpdate = await canGroupLeaderTagParticipant(
    serviceSupabase,
    auth.user.id,
    participantId,
    (await getCurrentOperationalEventId(serviceSupabase)) ?? "",
    assignmentId
  );

  if (!canUpdate) {
    return formFailureFromRedirect("/dashboard/capogruppo?error=forbidden");
  }

  if (hasIdentityUpdate) {
    const { error: participantUpdateError } = await serviceSupabase
      .from("participants")
      .update({
        first_name: firstName,
        last_name: lastName,
        birth_date: birthDate,
        city_other: city,
        country_other: country,
      })
      .eq("id", participantId);

    if (participantUpdateError) {
      return formFailureFromRedirect(`/dashboard/capogruppo?error=${encodeURIComponent(participantUpdateError.message)}`);
    }
  }

  if (formData.has("email") || formData.has("phone")) {
    const { data: currentContacts, error: contactReadError } = await serviceSupabase
      .from("participant_contacts")
      .select("id")
      .eq("participant_id", participantId)
      .eq("is_primary", true)
      .limit(1);

    if (contactReadError) {
      return formFailureFromRedirect(`/dashboard/capogruppo?error=${encodeURIComponent(contactReadError.message)}`);
    }

    const primaryContactId =
      ((currentContacts ?? []) as Array<{ id: string }>)[0]?.id ?? null;
    const values = {
      participant_id: participantId,
      email: email || null,
      phone,
      is_primary: true,
    };
    const result = primaryContactId
      ? await serviceSupabase
          .from("participant_contacts")
          .update({ email: values.email, phone: values.phone })
          .eq("id", primaryContactId)
      : await serviceSupabase.from("participant_contacts").insert(values);

    if (result.error) {
      return formFailureFromRedirect(`/dashboard/capogruppo?error=${encodeURIComponent(result.error.message)}`);
    }
  }

  await serviceSupabase.from("audit_logs").insert({
    actor_user_id: auth.user.id,
    action: "group_leader.participant_contact_updated",
    entity_table: "participants",
    entity_id: participantId,
    metadata: {
      assignment_id: assignmentId,
      identity_updated: hasIdentityUpdate,
      has_email: Boolean(email),
      has_phone: Boolean(phone),
    },
  });

  revalidatePath("/dashboard/capogruppo");
  redirect(`/dashboard/capogruppo?assignmentId=${encodeURIComponent(assignmentId)}&saved=contact`);
}

export async function createOperationalTag(formData: FormData) {
  const label = normalizeOperationalTagLabel(
    formData.get("operationalTagLabel") ?? formData.get("label")
  );
  const color = normalizeOperationalTagColor(formData.get("color"));
  const eventId =
    optionalText(formData.get("eventId")) ??
    (await getCurrentOperationalEventId(createSupabaseServiceClient()));
  const nav = optionalText(formData.get("nav")) === "mini" ? "mini" : "full";
  const sourceDashboard =
    optionalText(formData.get("sourceDashboard")) === "admin" ? "admin" : "manager";
  const dashboardPath = operationsReturnPath(formData.get("returnTo"), sourceDashboard, nav);
  const errorParam = sourceDashboard === "admin" ? "adminError" : "managerError";
  const savedParam = sourceDashboard === "admin" ? "adminSaved" : "managerSaved";

  if (!label) return formFailure([{ field: formData.has("operationalTagLabel") ? "operationalTagLabel" : "label", code: "required" }]);

  if (!eventId) {
    return formFailureFromRedirect(`${dashboardPath}&${errorParam}=invalid`);
  }

  const supabase = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(supabase, sourceDashboard);

  if (!auth) {
    redirect("/login");
  }

  const canManageEvent = auth.eventRoles.some(
    (role) =>
      role.role === "admin" ||
      (role.role === "manager" && role.eventId === eventId)
  );

  if (!canManageEvent) {
    return formFailureFromRedirect(`${dashboardPath}&${errorParam}=forbidden`);
  }

  const serviceSupabase = createSupabaseServiceClient();
  const { data: tag, error } = await serviceSupabase
    .from("operational_tags")
    .insert({
      event_id: eventId,
      label,
      color,
      created_by: auth.user.id,
    })
    .select("id")
    .single();

  if (error || !tag) {
    return formFailureFromRedirect(`${dashboardPath}&${errorParam}=${encodeURIComponent(
        error?.code === "23505" ? "duplicate-tag" : error?.message ?? "tag"
      )}`);
  }

  await serviceSupabase.from("audit_logs").insert({
    event_id: eventId,
    actor_user_id: auth.user.id,
    action: "operational_tag.created",
    entity_table: "operational_tags",
    entity_id: (tag as { id: string }).id,
    metadata: { label },
  });

  revalidatePath("/dashboard/manager");
  revalidatePath("/dashboard/admin");
  redirect(`${dashboardPath}&${savedParam}=tag`);
}

export async function updateParticipantOperationalTags(formData: FormData) {
  const participantId = optionalText(formData.get("participantId"));
  const registrationId = optionalText(formData.get("registrationId"));
  const eventId = optionalText(formData.get("eventId"));
  const sourceDashboard = optionalText(formData.get("sourceDashboard"));
  const assignmentId = optionalText(formData.get("assignmentId"));
  const nav = optionalText(formData.get("nav")) === "mini" ? "mini" : "full";
  const selectedTagIds = Array.from(
    new Set(
      formData
        .getAll("tagIds")
        .map((value) => optionalText(value))
        .filter((value): value is string => Boolean(value))
    )
  );
  const isCapogruppo = sourceDashboard === "capogruppo";
  const isAdmin = sourceDashboard === "admin";
  const dashboardPath = isCapogruppo
    ? "/dashboard/capogruppo"
    : `/dashboard/${isAdmin ? "admin" : "manager"}?section=iscritti&nav=${nav}`;
  const operationsErrorParam = isAdmin ? "adminError" : "managerError";

  if (!participantId || !eventId) {
    return formFailureFromRedirect(`${dashboardPath}${isCapogruppo ? "?" : "&"}${isCapogruppo ? "error" : operationsErrorParam}=invalid`);
  }

  const supabase = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(
    supabase,
    isCapogruppo ? "capogruppo" : isAdmin ? "admin" : "manager"
  );

  if (!auth) {
    redirect("/login");
  }

  const serviceSupabase = createSupabaseServiceClient();
  const { data: activeRegistration, error: activeRegistrationError } = await serviceSupabase
    .from("registrations").select("id").eq("id", registrationId ?? "")
    .eq("participant_id", participantId).eq("event_id", eventId).is("deleted_at", null).maybeSingle();
  if (activeRegistrationError || !activeRegistration) return formFailure([{ field: null, code: "failed" }]);

  const canUpdate = isCapogruppo
    ? await canGroupLeaderTagParticipant(
        serviceSupabase,
        auth.user.id,
        participantId,
        eventId,
        assignmentId
      )
    : auth.eventRoles.some(
        (role) =>
          role.role === "admin" ||
          (role.role === "manager" && role.eventId === eventId)
      );

  if (!canUpdate) {
    return formFailureFromRedirect(`${dashboardPath}${isCapogruppo ? "?" : "&"}${isCapogruppo ? "error" : operationsErrorParam}=forbidden`);
  }

  const { data: tags, error: tagsError } = await serviceSupabase
    .from("operational_tags")
    .select("id")
    .eq("event_id", eventId);

  if (tagsError) {
    return formFailureFromRedirect(`${dashboardPath}${isCapogruppo ? "?" : "&"}${isCapogruppo ? "error" : operationsErrorParam}=${encodeURIComponent(tagsError.message)}`);
  }

  const eventTagIds = ((tags ?? []) as Array<{ id: string }>).map((tag) => tag.id);
  const eventTagIdSet = new Set(eventTagIds);

  if (selectedTagIds.some((tagId) => !eventTagIdSet.has(tagId))) {
    return formFailureFromRedirect(`${dashboardPath}${isCapogruppo ? "?" : "&"}${isCapogruppo ? "error" : operationsErrorParam}=invalid`);
  }

  if (eventTagIds.length > 0) {
    const { error: deleteError } = await serviceSupabase
      .from("participant_operational_tags")
      .delete()
      .eq("participant_id", participantId)
      .in("tag_id", eventTagIds);

    if (deleteError) {
      return formFailureFromRedirect(`${dashboardPath}${isCapogruppo ? "?" : "&"}${isCapogruppo ? "error" : operationsErrorParam}=${encodeURIComponent(deleteError.message)}`);
    }
  }

  if (selectedTagIds.length > 0) {
    const { error: insertError } = await serviceSupabase
      .from("participant_operational_tags")
      .insert(
        selectedTagIds.map((tagId) => ({
          participant_id: participantId,
          tag_id: tagId,
          assigned_by: auth.user.id,
        }))
      );

    if (insertError) {
      return formFailureFromRedirect(`${dashboardPath}${isCapogruppo ? "?" : "&"}${isCapogruppo ? "error" : operationsErrorParam}=${encodeURIComponent(insertError.message)}`);
    }
  }

  await serviceSupabase.from("audit_logs").insert({
    event_id: eventId,
    actor_user_id: auth.user.id,
    action: "participant.operational_tags_updated",
    entity_table: "participants",
    entity_id: participantId,
    metadata: {
      source_dashboard: isCapogruppo ? "capogruppo" : isAdmin ? "admin" : "manager",
      tag_ids: selectedTagIds,
    },
  });

  revalidatePath("/dashboard/manager");
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/capogruppo");

  if (isCapogruppo) {
    redirect(
      assignmentId
        ? `/dashboard/capogruppo?assignmentId=${encodeURIComponent(assignmentId)}&saved=tags`
        : "/dashboard/capogruppo?saved=tags"
    );
  }

  const operationsRedirectParams = new URLSearchParams({
    section: "iscritti",
    nav,
    [isAdmin ? "adminSaved" : "managerSaved"]: "tags",
  });

  if (registrationId) {
    operationsRedirectParams.set("edit", registrationId);
  }

  redirect(`/dashboard/${isAdmin ? "admin" : "manager"}?${operationsRedirectParams.toString()}`);
}

export async function saveEventService(formData: FormData) {
  const sourceDashboard = optionalText(formData.get("sourceDashboard"));
  const nav = optionalText(formData.get("nav")) === "mini" ? "mini" : "full";
  const serviceId = optionalText(formData.get("serviceId"));
  const eventId =
    optionalText(formData.get("eventId")) ??
    (await getCurrentOperationalEventId(createSupabaseServiceClient()));
  const labelInput = formData.get("eventServiceLabel") ?? formData.get("label");
  const label = normalizeEventServiceLabel(labelInput);
  const descriptionInput = formData.get("description");
  const description = normalizeEventServiceCatalogDescription(descriptionInput);
  const publicOrder = normalizeEventServiceOrder(formData.get("publicOrder"));
  const isActive = formData.get("isActive") === "1" || !serviceId;
  const dashboardPath = getEventServicesDashboardPath(sourceDashboard, nav);
  const errorParam = sourceDashboard === "admin" ? "adminError" : "serviceError";

  if (!label) return formFailure([{ field: formData.has("eventServiceLabel") ? "eventServiceLabel" : "label", code: "required" }]);

  if (!eventId) {
    return formFailureFromRedirect(`${dashboardPath}&${errorParam}=invalid`);
  }

  if (!isEventServiceLabelWithinLimit(labelInput)) {
    return formFailureFromRedirect(`${dashboardPath}&${errorParam}=service-label-too-long`);
  }

  if (!isEventServiceDescriptionWithinLimit(descriptionInput)) {
    return formFailureFromRedirect(`${dashboardPath}&${errorParam}=service-description-too-long`);
  }

  const supabase = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(
    supabase,
    sourceDashboard === "admin" ? "admin" : "manager"
  );

  if (!auth) {
    redirect("/login");
  }

  const canManageEvent = auth.eventRoles.some(
    (role) =>
      role.role === "admin" ||
      (role.role === "manager" && role.eventId === eventId)
  );

  if (!canManageEvent) {
    return formFailureFromRedirect(`${dashboardPath}&${errorParam}=forbidden`);
  }

  const serviceSupabase = createSupabaseServiceClient();
  const payload = {
    event_id: eventId,
    label,
    description,
    public_order: publicOrder,
    is_active: isActive,
    updated_by: auth.user.id,
  };
  const result = serviceId
    ? await serviceSupabase
        .from("event_services")
        .update(payload)
        .eq("id", serviceId)
        .eq("event_id", eventId)
        .select("id")
        .maybeSingle()
    : await serviceSupabase
        .from("event_services")
        .insert({
          ...payload,
          created_by: auth.user.id,
        })
        .select("id")
        .single();

  if (result.error || !result.data) {
    return formFailureFromRedirect(`${dashboardPath}&${errorParam}=${encodeURIComponent(
        result.error?.code === "23505"
          ? "duplicate-service"
          : result.error?.message ?? "service"
      )}`);
  }

  await serviceSupabase.from("audit_logs").insert({
    event_id: eventId,
    actor_user_id: auth.user.id,
    action: serviceId ? "event_service.updated" : "event_service.created",
    entity_table: "event_services",
    entity_id: (result.data as { id: string }).id,
    metadata: {
      label,
      is_active: isActive,
      source_dashboard: sourceDashboard === "admin" ? "admin" : "manager",
    },
  });

  revalidatePath("/dashboard/manager");
  revalidatePath("/dashboard/admin");

  const savedParam = sourceDashboard === "admin" ? "adminSaved" : "serviceSaved";
  redirect(`${dashboardPath}&${savedParam}=service`);
}

export async function updateParticipantEventService(formData: FormData) {
  const sourceDashboard = optionalText(formData.get("sourceDashboard"));
  const nav = optionalText(formData.get("nav")) === "mini" ? "mini" : "full";
  const participantId = optionalText(formData.get("participantId"));
  const registrationId = optionalText(formData.get("registrationId"));
  const eventId = optionalText(formData.get("eventId"));
  const serviceId = optionalText(formData.get("serviceId"));
  const assignmentId = optionalText(formData.get("assignmentId"));
  const operatorNote = normalizeEventServiceDescription(formData.get("operatorNote"));
  const status = parseParticipantEventServiceStatus(formData.get("status"));
  const isCapogruppo = sourceDashboard === "capogruppo";
  const isAdmin = sourceDashboard === "admin";
  const dashboardPath = getParticipantServiceDashboardPath(
    sourceDashboard,
    nav,
    registrationId,
    assignmentId
  );
  const errorParam = isCapogruppo ? "error" : isAdmin ? "adminError" : "managerError";

  if (!participantId || !registrationId || !eventId) {
    return formFailureFromRedirect(`${dashboardPath}&${errorParam}=invalid`);
  }

  const supabase = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(
    supabase,
    isCapogruppo ? "capogruppo" : isAdmin ? "admin" : "manager"
  );

  if (!auth) {
    redirect("/login");
  }

  const serviceSupabase = createSupabaseServiceClient();
  const { data: activeRegistration, error: activeRegistrationError } = await serviceSupabase
    .from("registrations").select("id").eq("id", registrationId ?? "")
    .eq("participant_id", participantId).eq("event_id", eventId).is("deleted_at", null).maybeSingle();
  if (activeRegistrationError || !activeRegistration) return formFailure([{ field: null, code: "failed" }]);

  const canUpdate = isCapogruppo
    ? await canGroupLeaderTagParticipant(
        serviceSupabase,
        auth.user.id,
        participantId,
        eventId,
        assignmentId
      )
    : auth.eventRoles.some(
        (role) =>
          role.role === "admin" ||
          (role.role === "manager" && role.eventId === eventId)
      );

  if (!canUpdate) {
    return formFailureFromRedirect(`${dashboardPath}&${errorParam}=forbidden`);
  }

  if (!serviceId) {
    const { error: deleteError } = await serviceSupabase
      .from("participant_event_services")
      .delete()
      .eq("event_id", eventId)
      .eq("participant_id", participantId);

    if (deleteError) {
      return formFailureFromRedirect(`${dashboardPath}&${errorParam}=${encodeURIComponent(deleteError.message)}`);
    }

    await serviceSupabase.from("audit_logs").insert({
      event_id: eventId,
      actor_user_id: auth.user.id,
      action: "participant.event_service_removed",
      entity_table: "participants",
      entity_id: participantId,
      metadata: { source_dashboard: sourceDashboard ?? "manager" },
    });

    revalidatePath("/dashboard/manager");
    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/capogruppo");
    redirect(getParticipantServiceSuccessPath(sourceDashboard, nav, registrationId, assignmentId));
  }

  const [{ data: service }, { data: registration }] = await Promise.all([
    serviceSupabase
      .from("event_services")
      .select("id,event_id,is_active")
      .eq("id", serviceId)
      .eq("event_id", eventId)
      .maybeSingle(),
    serviceSupabase
      .from("registrations")
      .select("id,event_id,participant_id")
      .is("deleted_at", null)
      .eq("id", registrationId)
      .eq("event_id", eventId)
      .eq("participant_id", participantId)
      .maybeSingle(),
  ]);

  if (!service || !registration) {
    return formFailureFromRedirect(`${dashboardPath}&${errorParam}=invalid`);
  }

  const now = new Date().toISOString();
  const source = isCapogruppo ? "capogruppo" : "manager";
  const payload = {
    event_id: eventId,
    registration_id: registrationId,
    participant_id: participantId,
    service_id: serviceId,
    status,
    source,
    operator_note: operatorNote,
    updated_by: auth.user.id,
    proposed_at: status === "proposal_pending" ? now : null,
    assigned_at: status === "assigned" ? now : null,
    decided_at: status === "assigned" || status === "declined" ? now : null,
  };
  const { data: savedService, error: upsertError } = await serviceSupabase
    .from("participant_event_services")
    .upsert(
      {
        ...payload,
        created_by: auth.user.id,
      },
      { onConflict: "event_id,participant_id" }
    )
    .select("id")
    .single();

  if (upsertError || !savedService) {
    return formFailureFromRedirect(`${dashboardPath}&${errorParam}=${encodeURIComponent(
        upsertError?.message ?? "service"
      )}`);
  }

  await serviceSupabase.from("audit_logs").insert({
    event_id: eventId,
    actor_user_id: auth.user.id,
    action: "participant.event_service_updated",
    entity_table: "participant_event_services",
    entity_id: (savedService as { id: string }).id,
    metadata: {
      participant_id: participantId,
      registration_id: registrationId,
      service_id: serviceId,
      status,
      source_dashboard: sourceDashboard ?? "manager",
    },
  });

  revalidatePath("/dashboard/manager");
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/capogruppo");
  redirect(getParticipantServiceSuccessPath(sourceDashboard, nav, registrationId, assignmentId));
}

async function canGroupLeaderTagParticipant(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  userId: string,
  participantId: string,
  eventId: string,
  assignmentId: string | null
): Promise<boolean> {
  const [{ data: memberships }, { data: groups }] = await Promise.all([
    supabase.from("group_memberships").select("group_id").eq("user_id", userId),
    supabase
      .from("groups")
      .select("id,parent_group_id")
      .eq("event_id", eventId)
      .eq("is_active", true),
  ]);
  const rootGroupIds = ((memberships ?? []) as Array<{ group_id: string | null }>)
    .map((membership) => membership.group_id)
    .filter((groupId): groupId is string => Boolean(groupId));
  const groupNodes = ((groups ?? []) as Array<{
    id: string;
    parent_group_id: string | null;
  }>).map<GroupTreeNode>((group) => ({
    id: group.id,
    parentGroupId: group.parent_group_id,
  }));
  const scopedGroupIds = collectDescendantGroupIds(groupNodes, rootGroupIds);

  if (scopedGroupIds.size === 0) {
    return false;
  }

  let query = supabase
    .from("participant_group_assignments")
    .select("id,group_id,registrations!inner(event_id,participant_id)")
    .eq("is_current", true)
    .eq("registrations.event_id", eventId)
    .eq("registrations.participant_id", participantId)
    .is("registrations.deleted_at", null)
    .in("group_id", [...scopedGroupIds])
    .limit(1);

  if (assignmentId) {
    query = query.eq("id", assignmentId);
  }

  const { data, error } = await query;

  return !error && Boolean(data?.length);
}

export async function createGroupLeaderManualRegistration(formData: FormData) {
  const contactIssues = validateContactFields(formData);
  if (contactIssues.length) return formFailure(contactIssues);
  const parsed = parseManualRegistrationForm(formData);

  if (!parsed.ok) {
    return formFailure(parsed.errors.map(issueFromMessage));
  }

  const supabase = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(supabase, "capogruppo");

  if (!auth || auth.dashboardRole !== "capogruppo") {
    redirect("/login");
  }

  const serviceSupabase = createSupabaseServiceClient();
  const { data: group, error: groupError } = await serviceSupabase
    .from("groups")
    .select("id,event_id,name,country_id,city_id,is_active,is_assignable,events(starts_on,ends_on)")
    .eq("id", parsed.value.groupId)
    .maybeSingle();
  const groupRow = group as
    | {
        id: string;
        event_id: string;
        name: string | null;
        country_id: string | null;
        city_id: string | null;
        is_active: boolean | null;
        is_assignable: boolean | null;
        events: { starts_on: string | null; ends_on: string | null } | Array<{ starts_on: string | null; ends_on: string | null }> | null;
      }
    | null;

  if (
    groupError ||
    !groupRow ||
    !groupRow.is_active ||
    !groupRow.is_assignable ||
    !(await canManageGroupRegistrationLink(
      serviceSupabase,
      auth.user.id,
      auth.eventRoles,
      groupRow.id,
      groupRow.event_id,
      "capogruppo"
    ))
  ) {
    return formFailureFromRedirect("/dashboard/capogruppo?manualError=forbidden");
  }

  if (
    parsed.value.email &&
    (await hasExistingRegistrationForEmail(
      serviceSupabase,
      parsed.value.email,
      groupRow.event_id
    ))
  ) {
    return formFailureFromRedirect("/dashboard/capogruppo?manualError=duplicate-email");
  }

  const eventDates = relatedOne(groupRow.events);
  const { compareIdentities, identityFingerprint } = await import("@/lib/data-quality/duplicates");
  const { hashIdentityFingerprint } = await import("@/lib/data-quality/fingerprint.server");
  const { loadQualityPeople } = await import("@/lib/data-quality/data.server");
  const duplicateCandidates = (await loadQualityPeople(serviceSupabase, groupRow.event_id)).filter(person => compareIdentities({
    id: "manual-entry", firstName: parsed.value.firstName, lastName: parsed.value.lastName,
    birthDate: parsed.value.birthDate, email: parsed.value.email, phone: parsed.value.phone,
    country: null, city: null,
  }, person));
  const duplicateReason = String(formData.get("duplicateReason") ?? "").trim();
  if (duplicateCandidates.some(person => person.deletedAt)) return formFailure([{ field: null, code: "forbidden" }]);
  if (duplicateCandidates.length && (duplicateReason.length < 3 || duplicateReason.length > 500))
    return formFailure([{ field: "duplicateReason", code: "duplicate" }]);
  const allowedAttendanceSlots = buildAllowedAttendanceSlotKeys(
    eventDates?.starts_on ?? null,
    eventDates?.ends_on ?? null
  );

  if (
    !parsed.value.availabilityUnknown &&
    parsed.value.availabilitySlots.some(
      (slot) => !allowedAttendanceSlots.has(attendanceSlotKey(slot))
    )
  ) {
    return formFailureFromRedirect("/dashboard/capogruppo?manualError=invalid-days");
  }


  const { data: participant, error: participantError } = await serviceSupabase
    .from("participants")
    .insert({
      first_name: parsed.value.firstName,
      last_name: parsed.value.lastName,
      birth_date: parsed.value.birthDate,
      preferred_locale: parsed.value.preferredLocale,
      country_id: groupRow.country_id,
      city_id: groupRow.city_id,
      has_previous_santegidio_participation: true,
      participates_with_group: true,
    })
    .select("id,public_code")
    .single();

  if (participantError || !participant) {
    return formFailureFromRedirect(`/dashboard/capogruppo?manualError=${encodeURIComponent(
        participantError?.message ?? "participant"
      )}`);
  }

  const participantRow = participant as { id: string; public_code: string };
  const { data: registration, error: registrationError } = await serviceSupabase
    .from("registrations")
    .insert({
      event_id: groupRow.event_id,
      participant_id: participantRow.id,
      source: "capogruppo",
      created_by: auth.user.id,
    })
    .select("id")
    .single();

  if (registrationError || !registration) {
    return formFailureFromRedirect(`/dashboard/capogruppo?manualError=${encodeURIComponent(
        registrationError?.message ?? "registration"
      )}`);
  }

  const registrationId = (registration as { id: string }).id;
  const qrToken = createOpaqueQrToken();
  const attendanceRows =
    parsed.value.availabilityUnknown
      ? [{ registration_id: registrationId, choice: "unknown" }]
      : parsed.value.availabilitySlots.map((slot) => ({
          registration_id: registrationId,
          day: slot.day,
          day_part: slot.part,
          choice: "yes",
        }));
  const writes = [
    serviceSupabase.from("participant_contacts").insert({
      participant_id: participantRow.id,
      email: parsed.value.email,
      phone: parsed.value.phone,
      is_primary: true,
    }),
    serviceSupabase.from("participant_consents").insert({
      registration_id: registrationId,
      privacy_version: PRIVACY_VERSION,
      privacy_accepted_at: new Date().toISOString(),
      data_processing_accepted: true,
      future_events_communications_accepted: false,
      accepted_by_user_id: auth.user.id,
      accepted_by_name: `${parsed.value.firstName} ${parsed.value.lastName}`.trim(),
    }),
    serviceSupabase.from("accessibility_needs").insert({
      registration_id: registrationId,
      washington_group_answers: parsed.value.accessibilityAnswers,
    }),
    serviceSupabase.from("registration_questionnaire_answers").insert({
      registration_id: registrationId,
      event_id: groupRow.event_id,
      questionnaire_version: REGISTRATION_QUESTIONNAIRE_VERSION,
      answers: buildManualRegistrationQuestionnaireAnswers(parsed.value, {
        id: groupRow.id,
        name: groupRow.name,
      }),
      visibility_summary: getQuestionnaireVisibilitySummary(),
    }),
    ...(parsed.value.children.length > 0
      ? [
          serviceSupabase
            .from("registration_children")
            .insert(
              toRegistrationChildRows(registrationId, parsed.value.children)
            ),
        ]
      : []),
    serviceSupabase.from("qr_tokens").insert({
      registration_id: registrationId,
      token_hash: qrToken.tokenHash,
      token_encrypted: encryptQrToken(qrToken.token),
      created_by: auth.user.id,
    }),
    serviceSupabase.from("participant_group_assignments").insert({
      registration_id: registrationId,
      group_id: groupRow.id,
      status: "confirmed",
      source: "capogruppo",
      confidence: 1,
      is_current: true,
      assignment_reason: "group_leader_manual_entry",
      matcher_version: "group-leader-manual-v1",
      confirmed_by: auth.user.id,
      confirmed_at: new Date().toISOString(),
      leader_decision_by: auth.user.id,
      leader_decision_at: new Date().toISOString(),

      leader_internal_note: parsed.value.leaderNote,
      leader_note_updated_by: parsed.value.leaderNote ? auth.user.id : null,
      leader_note_updated_at: parsed.value.leaderNote
        ? new Date().toISOString()
        : null,
    }),
    serviceSupabase.from("audit_logs").insert({
      event_id: groupRow.event_id,
      actor_user_id: auth.user.id,
      action: "registration.created_by_group_leader",
      entity_table: "registrations",
      entity_id: registrationId,
      metadata: {
        group_id: groupRow.id,
        source: "capogruppo",
        has_email: Boolean(parsed.value.email),
        has_phone: Boolean(parsed.value.phone),
        accompanying_children_count: parsed.value.children.length,
        participant_public_code: participantRow.public_code,
        duplicate_candidate_ids: duplicateCandidates.map(person => person.id),
        duplicate_review_reason: duplicateCandidates.length ? duplicateReason : null,
      },
    }),
  ];

  if (attendanceRows.length > 0) {
    writes.push(serviceSupabase.from("event_attendance_choices").insert(attendanceRows));
  }

  if (duplicateCandidates.length) {
    const fingerprint = hashIdentityFingerprint(identityFingerprint({ id: registrationId, firstName: parsed.value.firstName, lastName: parsed.value.lastName,
      birthDate: parsed.value.birthDate, email: parsed.value.email, phone: parsed.value.phone, country: null, city: null }));
    writes.push(serviceSupabase.from("duplicate_reviews").insert(duplicateCandidates.map(person => ({
      event_id: groupRow.event_id, left_id: registrationId < person.id ? registrationId : person.id,
      right_id: registrationId < person.id ? person.id : registrationId, decision: "not_duplicate",
      left_fingerprint: registrationId < person.id ? fingerprint : hashIdentityFingerprint(identityFingerprint(person)),
      right_fingerprint: registrationId < person.id ? hashIdentityFingerprint(identityFingerprint(person)) : fingerprint,
      reason: duplicateReason, actor_user_id: auth.user.id,
    }))));
    writes.push(serviceSupabase.from("audit_logs").insert({ event_id: groupRow.event_id, actor_user_id: auth.user.id,
      action: "duplicate.false_positive_manual", entity_table: "registrations", entity_id: registrationId,
      metadata: { candidate_ids: duplicateCandidates.map(person => person.id), reason: duplicateReason } }));
  }

  const results = await Promise.all(writes);
  const failedWrite = results.find((result) => result.error);

  if (failedWrite?.error) {
    return formFailureFromRedirect(`/dashboard/capogruppo?manualError=${encodeURIComponent(
        failedWrite.error.message
      )}`);
  }

  revalidatePath("/dashboard/capogruppo");
  redirect("/dashboard/capogruppo?manualSaved=1");
}

export async function updateGroupRegistrationLink(formData: FormData) {
  const slug = optionalText(formData.get("slug"));
  if (slug && (!isValidGroupRegistrationLinkToken(slug) || isReservedGroupRegistrationLinkToken(slug))) {
    return formFailure([{ field: "slug", code: "invalid" }]);
  }
  const linkId = optionalText(formData.get("linkId"));
  const sourceDashboard = optionalText(formData.get("sourceDashboard"));
  const dashboardPath = getGroupManagementDashboardPath(sourceDashboard);
  const publicLabel = normalizeGroupRegistrationPublicLabel(
    formData.get("displayName")
  );

  if (!linkId || !publicLabel) {
    return formFailureFromRedirect(`${dashboardPath}?groupLinkError=invalid`);
  }

  const supabase = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(
    supabase,
    getGroupManagementRequestedRole(sourceDashboard)
  );

  if (!auth) {
    redirect("/login");
  }

  const serviceSupabase = createSupabaseServiceClient();
  const { data: link, error: linkError } = await serviceSupabase
    .from("group_registration_links")
    .select("id,event_id,group_id,public_label")
    .eq("id", linkId)
    .eq("is_canonical", true)
    .maybeSingle();
  const linkRow = link as
    | {
        id: string;
        event_id: string;
        group_id: string;
        public_label: string | null;
      }
    | null;

  if (
    linkError ||
    !linkRow ||
    !(await canManageGroupRegistrationLink(serviceSupabase, auth.user.id, auth.eventRoles, linkRow.group_id, linkRow.event_id, sourceDashboard))
  ) {
    return formFailureFromRedirect(`${dashboardPath}?groupLinkError=forbidden`);
  }

  const { error: updateError } = await serviceSupabase
    .from("group_registration_links")
    .update({
      public_label: publicLabel,
      internal_label: publicLabel,
      ...(slug ? { slug, token_hash: hashGroupRegistrationLinkToken(slug), token_encrypted: encryptQrToken(slug) } : {}),
    })
    .eq("id", linkRow.id);

  if (updateError?.code === "23505") {
    return formFailure([{ field: "slug", code: "duplicate" }]);
  }
  if (updateError) {
    return formFailureFromRedirect(getGroupLinksModalPath(sourceDashboard, linkRow.group_id, {
        error: "update",
      }));
  }

  await serviceSupabase.from("audit_logs").insert({
    event_id: linkRow.event_id,
    actor_user_id: auth.user.id,
    action: "group_registration_link.updated",
    entity_table: "group_registration_links",
    entity_id: linkRow.id,
    metadata: {
      group_id: linkRow.group_id,
      public_label_changed: linkRow.public_label !== publicLabel,
    },
  });

  revalidatePath("/dashboard/manager");
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/capogruppo");
  redirect(
    getGroupLinksModalPath(sourceDashboard, linkRow.group_id, { saved: true })
  );
}

export async function saveOperationsGroup(formData: FormData) {
  const sourceDashboard = optionalText(formData.get("sourceDashboard"));
  const dashboardPath = getGroupManagementDashboardPath(sourceDashboard);
  const groupId = optionalText(formData.get("groupId"));
  const name = optionalText(formData.get("name"));
  const parentGroupId = optionalText(formData.get("parentGroupId"));
  const nodeType = optionalText(formData.get("groupNodeType"));
  const primaryLeaderUserId = optionalText(formData.get("primaryLeaderUserId"));
  const primaryLeaderMode =
    primaryLeaderUserId === "__new__"
      ? "new"
      : primaryLeaderUserId
        ? "existing"
        : "none";

  if (!name) return formFailure([{ field: "name", code: "required" }]);

  if (!nodeType || !isValidGroupNodeType(nodeType)) {
    return formFailureFromRedirect(`${dashboardPath}?groupError=invalid`);
  }

  const supabase = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(
    supabase,
    getGroupManagementRequestedRole(sourceDashboard)
  );

  if (!auth) {
    redirect("/login");
  }

  const serviceSupabase = createSupabaseServiceClient();
  const eventId =
    optionalText(formData.get("eventId")) ??
    (await getCurrentOperationalEventId(serviceSupabase));

  if (!eventId) {
    return formFailureFromRedirect(`${dashboardPath}?groupError=invalid`);
  }

  const isAdmin = auth.eventRoles.some((role) => role.role === "admin");
  const canManageEvent =
    isAdmin ||
    auth.eventRoles.some(
      (role) => role.role === "manager" && role.eventId === eventId
    );

  if (!canManageEvent || sourceDashboard === "capogruppo") {
    return formFailureFromRedirect(`${dashboardPath}?groupError=forbidden`);
  }

  let currentGroupRow: OperationsGroupRow | null = null;

  if (groupId) {
    const { data: currentGroup, error: currentGroupError } = await serviceSupabase
      .from("groups")
      .select(
        "id,event_id,community_kind,age_brackets,is_assignable,is_public_catalog,is_active,public_order"
      )
      .eq("id", groupId)
      .maybeSingle();
    currentGroupRow = currentGroup as OperationsGroupRow | null;

    if (
      currentGroupError ||
      !currentGroupRow ||
      currentGroupRow.event_id !== eventId
    ) {
      return formFailureFromRedirect(`${dashboardPath}?groupError=not-found`);
    }
  }

  const { data: tree, error: treeError } = await serviceSupabase
    .from("groups").select("id,parent_group_id,node_type").eq("event_id", eventId);
  const parent = tree?.find((row) => row.id === parentGroupId);
  const descendants = collectDescendantGroupIds((tree ?? []).map((row) => ({
    id: row.id, parentGroupId: row.parent_group_id,
  })), groupId ? [groupId] : []);
  if (treeError || (parentGroupId && (!parent || descendants.has(parentGroupId))) ||
      (nodeType === "country" && parentGroupId) ||
      (nodeType === "city" && parent?.node_type !== "country") ||
      (nodeType === "area" && parent?.node_type !== "city")) {
    return formFailure([{ field: "parentGroupId", code: "group" }]);
  }

  const communityKind =
    optionalText(formData.get("communityKind")) ??
    (nodeType === "country" || nodeType === "city" || nodeType === "area"
      ? "territorial"
      : "santegidio");
  const submittedAgeBands = formData
    .getAll("ageBands")
    .map((value) => String(value));
  const hasInvalidAgeBand = submittedAgeBands.some(
    (value) => !isValidGroupAgeBand(value)
  );
  const ageBands = Array.from(new Set(submittedAgeBands));
  const isAssignable = nodeType === "group" ? true : formData.has("isAssignable")
    ? formData.get("isAssignable") === "on"
    : currentGroupRow?.is_assignable ?? false;
  const isPublicCatalog = formData.has("isPublicCatalog")
    ? isAssignable && formData.get("isPublicCatalog") === "on"
    : isAssignable && (currentGroupRow?.is_public_catalog ?? true);
  const isActive = formData.has("isActive")
    ? formData.get("isActive") === "on"
    : currentGroupRow?.is_active ?? true;
  const publicOrder =
    currentGroupRow?.public_order ??
    (await getNextGroupPublicOrder(serviceSupabase, eventId, parentGroupId));

  if (
    !isValidGroupCommunityKind(communityKind) ||
    hasInvalidAgeBand
  ) {
    return formFailureFromRedirect(`${dashboardPath}?groupError=invalid`);
  }

  let assignedLeader: GroupLeaderTargetResult | null = null;

  if (primaryLeaderMode === "existing") {
    assignedLeader = await getExistingGroupLeaderUserTarget(
      serviceSupabase,
      primaryLeaderUserId
    );
  } else if (primaryLeaderMode === "new") {
    assignedLeader = await getNewGroupLeaderTarget(serviceSupabase, {
      firstName: optionalText(formData.get("leaderFirstName")),
      lastName: optionalText(formData.get("leaderLastName")),
      email: normalizeEmail(formData.get("leaderEmail")),
    });
  }

  if (assignedLeader && !assignedLeader.ok) {
    return formFailureFromRedirect(`${dashboardPath}?groupError=${assignedLeader.error}`);
  }

  const values = {
    event_id: eventId,
    name,
    parent_group_id: parentGroupId,
    node_type: nodeType,
    community_kind: communityKind,
    age_brackets: ageBands,
    is_assignable: isAssignable,
    is_public_catalog: isPublicCatalog,
    is_active: isActive,
    public_label: normalizeGroupRegistrationPublicLabel(name),
    public_order: publicOrder,
  };
  const result = groupId
    ? await serviceSupabase.from("groups").update(values).eq("id", groupId)
    : await serviceSupabase.from("groups").insert(values).select("id").single();

  if (result.error) {
    return formFailureFromRedirect(`${dashboardPath}?groupError=${encodeURIComponent(result.error.message)}`);
  }

  const savedGroupId =
    groupId || ((result.data as { id?: string } | null)?.id ?? null);

  if (!savedGroupId) {
    return formFailureFromRedirect(`${dashboardPath}?groupError=create`);
  }

  if (assignedLeader?.ok) {
    const leaderError = await assignPrimaryGroupLeaderToGroup(
      serviceSupabase,
      {
        groupId: savedGroupId,
        eventId,
        actorUserId: auth.user.id,
        sourceDashboard,
        leader: assignedLeader,
      }
    );

    if (leaderError) {
      return formFailureFromRedirect(`${dashboardPath}?groupError=${encodeURIComponent(leaderError)}`);
    }
  }

  await serviceSupabase.from("audit_logs").insert({
    event_id: eventId,
    actor_user_id: auth.user.id,
    action: groupId ? "group.updated" : "group.created",
    entity_table: "groups",
    entity_id: savedGroupId,
    metadata: {
      source_dashboard: sourceDashboard === "admin" ? "admin" : "manager",
      is_assignable: isAssignable,
      is_public_catalog: isPublicCatalog,
      is_active: isActive,
      assigned_primary_leader: Boolean(assignedLeader?.ok),
    },
  });

  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/manager");
  redirect(`${dashboardPath}?groupSaved=1`);
}

export async function updateGroupPublicCatalogVisibility(formData: FormData) {
  const sourceDashboard = optionalText(formData.get("sourceDashboard"));
  const groupId = optionalText(formData.get("groupId"));
  const navMode = optionalText(formData.get("nav"));
  const isPublicCatalog = formData.get("isPublicCatalog") === "on";

  if (!groupId) {
    return formFailureFromRedirect(getGroupManagementListPath(sourceDashboard, navMode, "groupError=invalid"));
  }

  const supabase = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(
    supabase,
    getGroupManagementRequestedRole(sourceDashboard)
  );

  if (!auth) {
    redirect("/login");
  }

  const serviceSupabase = createSupabaseServiceClient();
  const { data: group, error: groupError } = await serviceSupabase
    .from("groups")
    .select("id,event_id,is_assignable,is_public_catalog")
    .eq("id", groupId)
    .maybeSingle();
  const groupRow = group as
    | {
        id: string;
        event_id: string;
        is_assignable: boolean | null;
        is_public_catalog: boolean | null;
      }
    | null;

  if (groupError || !groupRow) {
    return formFailureFromRedirect(getGroupManagementListPath(sourceDashboard, navMode, "groupError=not-found"));
  }

  const isAdmin = auth.eventRoles.some((role) => role.role === "admin");
  const canManageEvent =
    isAdmin ||
    auth.eventRoles.some(
      (role) => role.role === "manager" && role.eventId === groupRow.event_id
    );

  if (!canManageEvent || sourceDashboard === "capogruppo") {
    return formFailureFromRedirect(getGroupManagementListPath(sourceDashboard, navMode, "groupError=forbidden"));
  }

  if (!groupRow.is_assignable && isPublicCatalog) {
    return formFailureFromRedirect(getGroupManagementListPath(sourceDashboard, navMode, "groupError=invalid"));
  }

  const { error: updateError } = await serviceSupabase
    .from("groups")
    .update({ is_public_catalog: isPublicCatalog })
    .eq("id", groupId);

  if (updateError) {
    return formFailureFromRedirect(getGroupManagementListPath(
        sourceDashboard,
        navMode,
        `groupError=${encodeURIComponent(updateError.message)}`
      ));
  }

  await serviceSupabase.from("audit_logs").insert({
    event_id: groupRow.event_id,
    actor_user_id: auth.user.id,
    action: "group.public_catalog_updated",
    entity_table: "groups",
    entity_id: groupId,
    metadata: {
      source_dashboard: sourceDashboard === "admin" ? "admin" : "manager",
      previous_is_public_catalog: groupRow.is_public_catalog,
      is_public_catalog: isPublicCatalog,
    },
  });

  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/manager");
  redirect(getGroupManagementListPath(sourceDashboard, navMode, "groupSaved=1"));
}

export async function assignGroupLeader(formData: FormData) {
  const contactIssues = validateContactFields(formData);
  if (contactIssues.length) return formFailure(contactIssues);
  const sourceDashboard = optionalText(formData.get("sourceDashboard"));
  const dashboardPath = getGroupManagementDashboardPath(sourceDashboard);
  const groupId = optionalText(formData.get("groupId"));
  const mode = optionalText(formData.get("mode")) ?? "existing";
  const leaderKind = parseGroupLeaderKind(formData.get("leaderKind"));
  const isPrimaryLeader = leaderKind === "primary";

  if (!groupId || (mode !== "existing" && mode !== "new")) {
    return formFailureFromRedirect(`${dashboardPath}?groupError=invalid`);
  }

  const supabase = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(
    supabase,
    getGroupManagementRequestedRole(sourceDashboard)
  );

  if (!auth) {
    redirect("/login");
  }

  const serviceSupabase = createSupabaseServiceClient();
  const { data: group, error: groupError } = await serviceSupabase
    .from("groups")
    .select("id,event_id")
    .eq("id", groupId)
    .maybeSingle();
  const groupRow = group as { id: string; event_id: string } | null;

  if (groupError || !groupRow) {
    return formFailureFromRedirect(`${dashboardPath}?groupError=not-found`);
  }

  const isAdmin = auth.eventRoles.some((role) => role.role === "admin");
  const canManageEvent =
    isAdmin ||
    auth.eventRoles.some(
      (role) => role.role === "manager" && role.eventId === groupRow.event_id
    );

  if (!canManageEvent || sourceDashboard === "capogruppo") {
    return formFailureFromRedirect(`${dashboardPath}?groupError=forbidden`);
  }

  const leader =
    mode === "existing"
      ? await getExistingGroupLeaderTarget(
          serviceSupabase,
          optionalText(formData.get("participantId"))
        )
      : await getNewGroupLeaderTarget(serviceSupabase, {
          firstName: optionalText(formData.get("firstName")),
          lastName: optionalText(formData.get("lastName")),
          email: normalizeEmail(formData.get("email")),
        });

  if (!leader.ok) {
    return formFailureFromRedirect(`${dashboardPath}?groupError=${leader.error}`);
  }

  const membership = await serviceSupabase.from("group_memberships").upsert(
    {
      group_id: groupRow.id,
      user_id: leader.userId,
      role: "capogruppo",
      is_primary: isPrimaryLeader,
      created_by: auth.user.id,
    },
    { onConflict: "group_id,user_id" }
  );

  if (membership.error) {
    return formFailureFromRedirect(`${dashboardPath}?groupError=${encodeURIComponent(membership.error.message)}`);
  }

  const syncError = await syncGroupPrimaryLeaderName(
    serviceSupabase,
    groupRow.id,
    isPrimaryLeader ? leader.fullName : null
  );

  if (syncError) {
    return formFailureFromRedirect(`${dashboardPath}?groupError=${encodeURIComponent(syncError)}`);
  }

  await serviceSupabase.from("audit_logs").insert({
    event_id: groupRow.event_id,
    actor_user_id: auth.user.id,
    action: "group.leader_assigned",
    entity_table: "group_memberships",
    entity_id: groupRow.id,
    metadata: {
      source_dashboard: sourceDashboard === "admin" ? "admin" : "manager",
      participant_id: leader.participantId,
      created_minimal_participant: leader.createdParticipant,
      leader_kind: leaderKind,
    },
  });

  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/manager");
  revalidatePath("/dashboard/capogruppo");
  redirect(getGroupLeaderSuccessPath(sourceDashboard));
}

export async function assignOperationalUserRole(formData: FormData) {
  const contactIssues = validateContactFields(formData);
  if (contactIssues.length) return formFailure(contactIssues);
  const sourceDashboard = optionalText(formData.get("sourceDashboard"));
  const navMode = optionalText(formData.get("nav"));
  const dashboardPath = getOperationalUsersDashboardPath(sourceDashboard, navMode);
  const firstName = optionalText(formData.get("firstName"));
  const lastName = optionalText(formData.get("lastName"));
  const email = normalizeEmail(formData.get("email"));
  const role = optionalText(formData.get("role"));
  const groupId = optionalText(formData.get("groupId"));
  const leaderKind = parseGroupLeaderKind(formData.get("leaderKind"));
  const isPrimaryLeader = leaderKind === "primary";
  const sendInvite = formData.get("sendInvite") === "on";

  if (!firstName || !lastName || !email || !isAssignableOperationalRole(role)) {
    return formFailureFromRedirect(`${dashboardPath}&roleError=invalid`);
  }

  const supabase = await createSupabaseServerClient();
  const requestedRole = sourceDashboard === "admin" ? "admin" : "manager";
  const auth = await getCurrentAuthContext(supabase, requestedRole);

  if (!auth) {
    redirect("/login");
  }

  const isAdmin = auth.eventRoles.some((eventRole) => eventRole.role === "admin");
  const serviceSupabase = createSupabaseServiceClient();
  const fullName = `${firstName} ${lastName}`.trim();
  const currentEventId = await getCurrentOperationalEventId(serviceSupabase);

  if (role === "admin" && !isAdmin) {
    return formFailureFromRedirect(`${dashboardPath}&roleError=forbidden`);
  }

  let roleEventId: string | null = null;
  let roleGroupId: string | null = null;

  if (role === "capogruppo") {
    if (!groupId) {
      return formFailureFromRedirect(`${dashboardPath}&roleError=missing-group`);
    }

    const { data: group, error: groupError } = await serviceSupabase
      .from("groups")
      .select("id,event_id,name")
      .eq("id", groupId)
      .maybeSingle();
    const groupRow = group as
      | { id: string; event_id: string; name: string | null }
      | null;

    if (groupError || !groupRow) {
      return formFailureFromRedirect(`${dashboardPath}&roleError=invalid-group`);
    }

    const canManageGroupEvent =
      isAdmin ||
      auth.eventRoles.some(
        (eventRole) =>
          eventRole.role === "manager" && eventRole.eventId === groupRow.event_id
      );

    if (!canManageGroupEvent) {
      return formFailureFromRedirect(`${dashboardPath}&roleError=forbidden`);
    }

    roleEventId = groupRow.event_id;
    roleGroupId = groupRow.id;
  } else if (role !== "admin") {
    if (!currentEventId) {
      return formFailureFromRedirect(`${dashboardPath}&roleError=missing-event`);
    }

    const canManageRoleEvent =
      isAdmin ||
      auth.eventRoles.some(
        (eventRole) =>
          eventRole.role === "manager" && eventRole.eventId === currentEventId
      );

    if (!canManageRoleEvent) {
      return formFailureFromRedirect(`${dashboardPath}&roleError=forbidden`);
    }

    roleEventId = currentEventId;
  }

  const userId = await ensureAuthUserForGroupLeader(serviceSupabase, {
    email,
    fullName,
  });

  if (!userId) {
    return formFailureFromRedirect(`${dashboardPath}&roleError=auth-user`);
  }

  await syncOperationalIdentityByEmail(serviceSupabase, {
    email,
    firstName,
    lastName,
    userId,
  });

  if (role === "capogruppo") {
    if (!roleGroupId) {
      return formFailureFromRedirect(`${dashboardPath}&roleError=missing-group`);
    }

    const membership = await serviceSupabase.from("group_memberships").upsert(
      {
        group_id: roleGroupId,
        user_id: userId,
        role: "capogruppo",
        is_primary: isPrimaryLeader,
        created_by: auth.user.id,
      },
      { onConflict: "group_id,user_id" }
    );

    if (membership.error) {
      return formFailureFromRedirect(`${dashboardPath}&roleError=${encodeURIComponent(membership.error.message)}`);
    }

    const syncError = await syncGroupPrimaryLeaderName(
      serviceSupabase,
      roleGroupId,
      isPrimaryLeader ? fullName : null
    );

    if (syncError) {
      return formFailureFromRedirect(`${dashboardPath}&roleError=${encodeURIComponent(syncError)}`);
    }
  } else {
    const roleMatch = serviceSupabase
      .from("event_user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", role)
      .limit(1);
    const { data: existingRole, error: selectError } =
      role === "admin"
        ? await roleMatch.is("event_id", null)
        : await roleMatch.eq("event_id", roleEventId);

    if (selectError) {
      return formFailureFromRedirect(`${dashboardPath}&roleError=${encodeURIComponent(selectError.message)}`);
    }

    if (!existingRole?.length) {
      const { error: insertError } = await serviceSupabase
        .from("event_user_roles")
        .insert({
          user_id: userId,
          event_id: role === "admin" ? null : roleEventId,
          role,
          created_by: auth.user.id,
        });

      if (insertError) {
        return formFailureFromRedirect(`${dashboardPath}&roleError=${encodeURIComponent(insertError.message)}`);
      }
    }
  }

  await serviceSupabase.from("audit_logs").insert({
    event_id: roleEventId,
    actor_user_id: auth.user.id,
    action: "operational_user.role_assigned",
    entity_table: role === "capogruppo" ? "group_memberships" : "event_user_roles",
    entity_id: userId,
    metadata: {
      source_dashboard: sourceDashboard === "admin" ? "admin" : "manager",
      role,
      email_hash: hashEmailForAudit(email),
      group_id: roleGroupId,
      leader_kind: role === "capogruppo" ? leaderKind : null,
      invite_sent: sendInvite,
    },
  });

  if (sendInvite) {
    try {
      const invitePath = getOperationalRoleInvitePath(role, email);
      await sendMagicLinkEmail(
        serviceSupabase,
        email,
        `${getAppUrl()}/auth/callback?redirect_to=${encodeURIComponent(
          invitePath
        )}`
      );
    } catch (error) {
      await logEmailFailure(serviceSupabase, {
        eventId: roleEventId,
        action: "email.operational_role_invite_failed",
        email,
        error,
      });

      return formFailureFromRedirect(`${dashboardPath}&roleError=invite-email`);
    }
  }

  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/manager");
  revalidatePath("/dashboard/capogruppo");
  redirect(`${dashboardPath}&roleSaved=1`);
}

export async function updateOperationalUserRole(formData: FormData) {
  const contactIssues = validateContactFields(formData);
  if (contactIssues.length) return formFailure(contactIssues);
  const sourceDashboard = optionalText(formData.get("sourceDashboard"));
  const navMode = optionalText(formData.get("nav"));
  const dashboardPath = getOperationalUsersDashboardPath(sourceDashboard, navMode);
  const currentUserId = optionalText(formData.get("currentUserId"));
  const currentRole = optionalText(formData.get("currentRole"));
  const currentEventId = optionalText(formData.get("currentEventId"));
  const currentGroupId = optionalText(formData.get("currentGroupId"));
  const firstName = optionalText(formData.get("firstName"));
  const lastName = optionalText(formData.get("lastName"));
  const email = normalizeEmail(formData.get("email"));
  const role = optionalText(formData.get("role"));
  const eventId = optionalText(formData.get("eventId"));
  const groupId = optionalText(formData.get("groupId"));
  const selectedGroupIds = Array.from(
    new Set(
      formData
        .getAll("groupIds")
        .map((value) => optionalText(value))
        .filter((value): value is string => Boolean(value))
    )
  );
  const leaderKind = parseGroupLeaderKind(formData.get("leaderKind"));
  const isPrimaryLeader = leaderKind === "primary";
  const selectedLeaderKindsByGroupId = Object.fromEntries(
    selectedGroupIds.map((selectedGroupId) => [
      selectedGroupId,
      parseGroupLeaderKind(
        formData.get(`leaderKindByGroup:${selectedGroupId}`) ??
          formData.get("leaderKind")
      ),
    ])
  ) as Record<string, GroupLeaderKind>;

  if (
    !currentUserId ||
    !isAssignableOperationalRole(currentRole) ||
    !firstName ||
    !lastName ||
    !email ||
    !isAssignableOperationalRole(role)
  ) {
    return formFailureFromRedirect(`${dashboardPath}&roleError=invalid`);
  }

  const supabase = await createSupabaseServerClient();
  const requestedRole = sourceDashboard === "admin" ? "admin" : "manager";
  const auth = await getCurrentAuthContext(supabase, requestedRole);

  if (!auth) {
    redirect("/login");
  }

  const serviceSupabase = createSupabaseServiceClient();
  const isAdmin = auth.eventRoles.some((eventRole) => eventRole.role === "admin");
  const currentOperationalEventId = await getCurrentOperationalEventId(serviceSupabase);
  const currentTarget = await resolveOperationalRoleTarget(serviceSupabase, {
    userId: currentUserId,
    role: currentRole,
    eventId: currentEventId,
    groupId: currentGroupId,
  });

  if (!currentTarget.ok) {
    return formFailureFromRedirect(`${dashboardPath}&roleError=invalid`);
  }

  if (
    !canManageOperationalRole(auth.eventRoles, isAdmin, {
      role: currentRole,
      eventId: currentTarget.eventId,
    })
  ) {
    return formFailureFromRedirect(`${dashboardPath}&roleError=forbidden`);
  }

  const nextTarget = await resolveOperationalRoleTarget(serviceSupabase, {
    userId: null,
    role,
    eventId: role === "admin" || role === "capogruppo" ? eventId : currentOperationalEventId,
    groupId: role === "capogruppo" ? (selectedGroupIds[0] ?? groupId) : groupId,
  });

  if (!nextTarget.ok) {
    return formFailureFromRedirect(`${dashboardPath}&roleError=invalid`);
  }

  if (
    !canManageOperationalRole(auth.eventRoles, isAdmin, {
      role,
      eventId: nextTarget.eventId,
    })
  ) {
    return formFailureFromRedirect(`${dashboardPath}&roleError=forbidden`);
  }

  const fullName = `${firstName} ${lastName}`.trim();
  const targetUserId = await ensureAuthUserForGroupLeader(serviceSupabase, {
    email,
    fullName,
  });

  if (!targetUserId) {
    return formFailureFromRedirect(`${dashboardPath}&roleError=auth-user`);
  }

  if (targetUserId !== currentUserId) {
    return formFailureFromRedirect(`${dashboardPath}&roleError=email-taken`);
  }

  await syncOperationalIdentityByEmail(serviceSupabase, {
    email,
    firstName,
    lastName,
    userId: targetUserId,
  });

  if (role === "capogruppo" && selectedGroupIds.length > 0) {
    const { data: selectedGroups, error: selectedGroupsError } = await serviceSupabase
      .from("groups")
      .select("id,event_id")
      .in("id", selectedGroupIds);
    const selectedGroupRows = (selectedGroups ?? []) as Array<{
      id: string;
      event_id: string;
    }>;

    if (selectedGroupsError || selectedGroupRows.length !== selectedGroupIds.length) {
      return formFailureFromRedirect(`${dashboardPath}&roleError=invalid-group`);
    }

    const selectedGroupIdsSet = new Set(selectedGroupIds);

    if (
      selectedGroupRows.some(
        (group) =>
          !canManageOperationalRole(auth.eventRoles, isAdmin, {
            role: "capogruppo",
            eventId: group.event_id,
          })
      )
    ) {
      return formFailureFromRedirect(`${dashboardPath}&roleError=forbidden`);
    }

    const { data: existingMemberships } = await serviceSupabase
      .from("group_memberships")
      .select("group_id,is_primary,groups!inner(id,event_id)")
      .eq("user_id", targetUserId)
      .eq("role", "capogruppo");
    const manageableExistingMemberships = ((existingMemberships ?? []) as Array<{
      group_id: string | null;
      is_primary: boolean | null;
      groups:
        | { id: string; event_id: string }
        | Array<{ id: string; event_id: string }>
        | null;
    }>).filter((membership) => {
      const group = relatedOne(membership.groups);

      return Boolean(
        membership.group_id &&
          group &&
          canManageOperationalRole(auth.eventRoles, isAdmin, {
            role: "capogruppo",
            eventId: group.event_id,
          })
      );
    });
    const removedMemberships = manageableExistingMemberships.filter(
      (membership) =>
        membership.group_id && !selectedGroupIdsSet.has(membership.group_id)
    );
    if (removedMemberships.length > 0) {
      const removedGroupIds = removedMemberships
        .map((membership) => membership.group_id)
        .filter((removedGroupId): removedGroupId is string => Boolean(removedGroupId));
      const { error: removeError } = await serviceSupabase
        .from("group_memberships")
        .delete()
        .eq("user_id", targetUserId)
        .eq("role", "capogruppo")
        .in("group_id", removedGroupIds);

      if (removeError) {
        return formFailureFromRedirect(`${dashboardPath}&roleError=${encodeURIComponent(removeError.message)}`);
      }

      for (const membership of removedMemberships) {
        if (membership.is_primary && membership.group_id) {
          const syncError = await syncGroupPrimaryLeaderName(
            serviceSupabase,
            membership.group_id,
            null
          );

          if (syncError) {
            return formFailureFromRedirect(`${dashboardPath}&roleError=${encodeURIComponent(syncError)}`);
          }
        }
      }
    }

    for (const selectedGroupId of selectedGroupIds) {
      const selectedLeaderKind =
        selectedLeaderKindsByGroupId[selectedGroupId] ?? "secondary";
      const isSelectedPrimaryLeader = selectedLeaderKind === "primary";

      const membership = await serviceSupabase.from("group_memberships").upsert(
        {
          group_id: selectedGroupId,
          user_id: targetUserId,
          role: "capogruppo",
          is_primary: isSelectedPrimaryLeader,
          created_by: auth.user.id,
        },
        { onConflict: "group_id,user_id" }
      );

      if (membership.error) {
        return formFailureFromRedirect(`${dashboardPath}&roleError=${encodeURIComponent(membership.error.message)}`);
      }

      const syncError = await syncGroupPrimaryLeaderName(
        serviceSupabase,
        selectedGroupId,
        isSelectedPrimaryLeader ? fullName : null
      );

      if (syncError) {
        return formFailureFromRedirect(`${dashboardPath}&roleError=${encodeURIComponent(syncError)}`);
      }
    }

    await serviceSupabase.from("audit_logs").insert({
      event_id: selectedGroupRows[0]?.event_id ?? null,
      actor_user_id: auth.user.id,
      action: "operational_user.group_leader_groups_updated",
      entity_table: "group_memberships",
      entity_id: targetUserId,
      metadata: {
        source_dashboard: sourceDashboard === "admin" ? "admin" : "manager",
        role,
        email_hash: hashEmailForAudit(email),
        group_ids: selectedGroupIds,
        removed_group_ids: removedMemberships
          .map((membership) => membership.group_id)
          .filter(Boolean),
        leader_kinds_by_group_id: selectedLeaderKindsByGroupId,
      },
    });

    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/manager");
    revalidatePath("/dashboard/capogruppo");
    redirect(`${dashboardPath}&roleSaved=1`);
  }

  const currentSignature = operationalRoleSignature({
    userId: currentUserId,
    role: currentRole,
    eventId: currentRole === "admin" ? null : currentTarget.eventId,
    groupId: currentTarget.groupId,
  });
  const nextSignature = operationalRoleSignature({
    userId: targetUserId,
    role,
    eventId: role === "admin" ? null : nextTarget.eventId,
    groupId: nextTarget.groupId,
  });

  if (currentUserId === auth.user.id && currentSignature !== nextSignature) {
    return formFailureFromRedirect(`${dashboardPath}&roleError=self-role`);
  }

  if (currentSignature !== nextSignature) {
    const removeError = await removeOperationalRoleAssignment(serviceSupabase, {
      userId: currentUserId,
      role: currentRole,
      eventId: currentRole === "admin" ? null : currentTarget.eventId,
      groupId: currentTarget.groupId,
    });

    if (removeError) {
      return formFailureFromRedirect(`${dashboardPath}&roleError=${encodeURIComponent(removeError)}`);
    }

    if (currentTarget.isPrimaryGroupLeader && currentTarget.groupId) {
      const syncError = await syncGroupPrimaryLeaderName(
        serviceSupabase,
        currentTarget.groupId,
        null
      );

      if (syncError) {
        return formFailureFromRedirect(`${dashboardPath}&roleError=${encodeURIComponent(syncError)}`);
      }
    }
  }

  if (role === "capogruppo") {
    if (!nextTarget.groupId) {
      return formFailureFromRedirect(`${dashboardPath}&roleError=missing-group`);
    }

    const membership = await serviceSupabase.from("group_memberships").upsert(
      {
        group_id: nextTarget.groupId,
        user_id: targetUserId,
        role: "capogruppo",
        is_primary: isPrimaryLeader,
        created_by: auth.user.id,
      },
      { onConflict: "group_id,user_id" }
    );

    if (membership.error) {
      return formFailureFromRedirect(`${dashboardPath}&roleError=${encodeURIComponent(membership.error.message)}`);
    }

    const syncError = await syncGroupPrimaryLeaderName(
      serviceSupabase,
      nextTarget.groupId,
      isPrimaryLeader ? fullName : null
    );

    if (syncError) {
      return formFailureFromRedirect(`${dashboardPath}&roleError=${encodeURIComponent(syncError)}`);
    }
  } else {
    const roleMatch = serviceSupabase
      .from("event_user_roles")
      .select("id")
      .eq("user_id", targetUserId)
      .eq("role", role)
      .limit(1);
    const { data: existingRole, error: selectError } =
      role === "admin"
        ? await roleMatch.is("event_id", null)
        : await roleMatch.eq("event_id", nextTarget.eventId);

    if (selectError) {
      return formFailureFromRedirect(`${dashboardPath}&roleError=${encodeURIComponent(selectError.message)}`);
    }

    if (!existingRole?.length) {
      const { error: insertError } = await serviceSupabase
        .from("event_user_roles")
        .insert({
          user_id: targetUserId,
          event_id: role === "admin" ? null : nextTarget.eventId,
          role,
          created_by: auth.user.id,
        });

      if (insertError) {
        return formFailureFromRedirect(`${dashboardPath}&roleError=${encodeURIComponent(insertError.message)}`);
      }
    }
  }

  await serviceSupabase.from("audit_logs").insert({
    event_id: nextTarget.eventId,
    actor_user_id: auth.user.id,
    action: "operational_user.role_updated",
    entity_table: role === "capogruppo" ? "group_memberships" : "event_user_roles",
    entity_id: targetUserId,
    metadata: {
      source_dashboard: sourceDashboard === "admin" ? "admin" : "manager",
      previous_user_id: currentUserId,
      previous_role: currentRole,
      previous_event_id: currentTarget.eventId,
      previous_group_id: currentTarget.groupId,
      role,
      email_hash: hashEmailForAudit(email),
      group_id: nextTarget.groupId,
      leader_kind: role === "capogruppo" ? leaderKind : null,
    },
  });

  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/manager");
  revalidatePath("/dashboard/capogruppo");
  redirect(`${dashboardPath}&roleSaved=1`);
}

export async function deleteOperationalUserRole(formData: FormData) {
  const sourceDashboard = optionalText(formData.get("sourceDashboard"));
  const navMode = optionalText(formData.get("nav"));
  const dashboardPath = getOperationalUsersDashboardPath(sourceDashboard, navMode);
  const userId = optionalText(formData.get("userId"));
  const role = optionalText(formData.get("role"));
  const eventId = optionalText(formData.get("eventId"));
  const groupId = optionalText(formData.get("groupId"));

  if (!userId || !isAssignableOperationalRole(role)) {
    return formFailureFromRedirect(`${dashboardPath}&roleError=invalid`);
  }

  const supabase = await createSupabaseServerClient();
  const requestedRole = sourceDashboard === "admin" ? "admin" : "manager";
  const auth = await getCurrentAuthContext(supabase, requestedRole);

  if (!auth) {
    redirect("/login");
  }

  if (userId === auth.user.id) {
    return formFailureFromRedirect(`${dashboardPath}&roleError=self-role`);
  }

  const serviceSupabase = createSupabaseServiceClient();
  const isAdmin = auth.eventRoles.some((eventRole) => eventRole.role === "admin");
  const target = await resolveOperationalRoleTarget(serviceSupabase, {
    userId,
    role,
    eventId,
    groupId,
  });

  if (!target.ok) {
    return formFailureFromRedirect(`${dashboardPath}&roleError=invalid`);
  }

  if (
    !canManageOperationalRole(auth.eventRoles, isAdmin, {
      role,
      eventId: target.eventId,
    })
  ) {
    return formFailureFromRedirect(`${dashboardPath}&roleError=forbidden`);
  }

  const removeError = await removeOperationalRoleAssignment(serviceSupabase, {
    userId,
    role,
    eventId: role === "admin" ? null : target.eventId,
    groupId: target.groupId,
  });

  if (removeError) {
    return formFailureFromRedirect(`${dashboardPath}&roleError=${encodeURIComponent(removeError)}`);
  }

  if (target.isPrimaryGroupLeader && target.groupId) {
    const syncError = await syncGroupPrimaryLeaderName(
      serviceSupabase,
      target.groupId,
      null
    );

    if (syncError) {
      return formFailureFromRedirect(`${dashboardPath}&roleError=${encodeURIComponent(syncError)}`);
    }
  }

  await serviceSupabase.from("audit_logs").insert({
    event_id: target.eventId,
    actor_user_id: auth.user.id,
    action: "operational_user.role_deleted",
    entity_table: role === "capogruppo" ? "group_memberships" : "event_user_roles",
    entity_id: userId,
    metadata: {
      source_dashboard: sourceDashboard === "admin" ? "admin" : "manager",
      role,
      group_id: target.groupId,
    },
  });

  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/manager");
  revalidatePath("/dashboard/capogruppo");
  redirect(`${dashboardPath}&roleSaved=1`);
}

async function getExistingGroupLeaderTarget(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  participantId: string | null
): Promise<GroupLeaderTargetResult> {
  if (!participantId) {
    return { ok: false, error: "invalid" };
  }

  const { data: participant, error: participantError } = await supabase
    .from("participants")
    .select("id,auth_user_id,first_name,last_name")
    .eq("id", participantId)
    .maybeSingle();
  const participantRow = participant as
    | {
        id: string;
        auth_user_id: string | null;
        first_name: string | null;
        last_name: string | null;
      }
    | null;

  if (participantError || !participantRow) {
    return { ok: false, error: "invalid" };
  }

  const { data: contact } = await supabase
    .from("participant_contacts")
    .select("email")
    .eq("participant_id", participantId)
    .eq("is_primary", true)
    .maybeSingle();
  const email = normalizeEmail(
    (contact as { email: string | null } | null)?.email ?? null
  );
  const fullName = [participantRow.first_name, participantRow.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  const userId =
    participantRow.auth_user_id ||
    (await ensureAuthUserForGroupLeader(supabase, {
      email,
      fullName,
    }));

  if (!userId) {
    return { ok: false, error: "missing-email" };
  }

  if (!participantRow.auth_user_id) {
    const { error: updateError } = await supabase
      .from("participants")
      .update({ auth_user_id: userId })
      .eq("id", participantId);

    if (updateError) {
      return { ok: false, error: encodeURIComponent(updateError.message) };
    }
  }

  return {
    ok: true,
    participantId,
    userId,
    fullName: fullName || email || "Capogruppo",
    createdParticipant: false,
  };
}

async function getExistingGroupLeaderUserTarget(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  userId: string | null
): Promise<GroupLeaderTargetResult> {
  if (!userId || userId === "__new__") {
    return { ok: false, error: "invalid" };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("group_memberships")
    .select("user_id")
    .eq("user_id", userId)
    .eq("role", "capogruppo")
    .limit(1);

  if (membershipError || !((membership ?? []) as Array<{ user_id: string }>)[0]) {
    return { ok: false, error: "invalid-leader" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,email,full_name")
    .eq("id", userId)
    .maybeSingle();
  const profileRow = profile as
    | { id: string; email: string | null; full_name: string | null }
    | null;

  if (profileError || !profileRow) {
    return { ok: false, error: "invalid-leader" };
  }

  const { data: participant } = await supabase
    .from("participants")
    .select("id")
    .eq("auth_user_id", userId)
    .limit(1);
  const participantId =
    ((participant ?? []) as Array<{ id: string }>)[0]?.id ?? null;

  return {
    ok: true,
    participantId,
    userId,
    fullName: profileRow.full_name || profileRow.email || "Capogruppo",
    createdParticipant: false,
  };
}

async function getNewGroupLeaderTarget(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  input: {
    firstName: string | null;
    lastName: string | null;
    email: string;
  }
): Promise<GroupLeaderTargetResult> {
  if (!input.firstName || !input.lastName || !input.email) {
    return { ok: false, error: "invalid" };
  }

  const fullName = `${input.firstName} ${input.lastName}`.trim();
  const userId = await ensureAuthUserForGroupLeader(supabase, {
    email: input.email,
    fullName,
  });

  if (!userId) {
    return { ok: false, error: "auth-user" };
  }

  const { data: existingContacts } = await supabase
    .from("participant_contacts")
    .select("participant_id")
    .eq("email", input.email)
    .limit(1);
  const existingParticipantId = (
    existingContacts as Array<{ participant_id: string }> | null
  )?.[0]?.participant_id;

  if (existingParticipantId) {
    const { error: updateError } = await supabase
      .from("participants")
      .update({
        auth_user_id: userId,
        first_name: input.firstName,
        last_name: input.lastName,
      })
      .eq("id", existingParticipantId);

    if (updateError) {
      return { ok: false, error: encodeURIComponent(updateError.message) };
    }

    return {
      ok: true,
      participantId: existingParticipantId,
      userId,
      fullName,
      createdParticipant: false,
    };
  }

  const { data: participant, error: participantError } = await supabase
    .from("participants")
    .insert({
      auth_user_id: userId,
      first_name: input.firstName,
      last_name: input.lastName,
      preferred_locale: "it",
    })
    .select("id")
    .single();
  const participantId = (participant as { id?: string } | null)?.id ?? null;

  if (participantError || !participantId) {
    return {
      ok: false,
      error: encodeURIComponent(participantError?.message ?? "participant"),
    };
  }

  const { error: contactError } = await supabase.from("participant_contacts").insert({
    participant_id: participantId,
    email: input.email,
    is_primary: true,
  });

  if (contactError) {
    return { ok: false, error: encodeURIComponent(contactError.message) };
  }

  return {
    ok: true,
    participantId,
    userId,
    fullName,
    createdParticipant: true,
  };
}

async function ensureAuthUserForGroupLeader(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  input: {
    email: string;
    fullName: string | null;
  }
): Promise<string | null> {
  if (!input.email) {
    return null;
  }

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: input.email,
    email_confirm: true,
    user_metadata: input.fullName ? { full_name: input.fullName } : undefined,
  });

  if (created.user?.id) {
    await upsertGroupLeaderProfile(supabase, created.user.id, input);

    return created.user.id;
  }

  const message = createError?.message ?? "";

  if (!/already|registered|exists/i.test(message)) {
    return null;
  }

  const { data: users, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listError) {
    return null;
  }

  const existing = users.users.find(
    (user) => user.email?.toLowerCase() === input.email
  );

  if (!existing) {
    return null;
  }

  await upsertGroupLeaderProfile(supabase, existing.id, input);

  return existing.id;
}

async function upsertGroupLeaderProfile(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  userId: string,
  input: {
    email: string;
    fullName: string | null;
  }
) {
  await supabase.from("profiles").upsert(
    {
      id: userId,
      email: input.email,
      full_name: input.fullName,
    },
    { onConflict: "id" }
  );
}

type GroupLeaderKind = "primary" | "secondary";

function parseGroupLeaderKind(value: FormDataEntryValue | null): GroupLeaderKind {
  return value === "primary" ? "primary" : "secondary";
}

async function getNextGroupPublicOrder(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  eventId: string,
  parentGroupId: string | null
): Promise<number> {
  let query = supabase
    .from("groups")
    .select("public_order")
    .eq("event_id", eventId)
    .order("public_order", { ascending: false })
    .limit(1);

  query = parentGroupId
    ? query.eq("parent_group_id", parentGroupId)
    : query.is("parent_group_id", null);

  const { data } = await query;
  const currentMax =
    ((data ?? []) as Array<{ public_order: number | null }>)[0]?.public_order ??
    90;

  return currentMax + 10;
}

async function assignPrimaryGroupLeaderToGroup(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  input: {
    groupId: string;
    eventId: string;
    actorUserId: string;
    sourceDashboard: string | null;
    leader: Extract<GroupLeaderTargetResult, { ok: true }>;
  }
): Promise<string | null> {
  const membership = await supabase.from("group_memberships").upsert(
    {
      group_id: input.groupId,
      user_id: input.leader.userId,
      role: "capogruppo",
      is_primary: true,
      created_by: input.actorUserId,
    },
    { onConflict: "group_id,user_id" }
  );

  if (membership.error) {
    return membership.error.message;
  }

  const syncError = await syncGroupPrimaryLeaderName(
    supabase,
    input.groupId,
    input.leader.fullName
  );

  if (syncError) {
    return syncError;
  }

  await supabase.from("audit_logs").insert({
    event_id: input.eventId,
    actor_user_id: input.actorUserId,
    action: "group.leader_assigned",
    entity_table: "group_memberships",
    entity_id: input.groupId,
    metadata: {
      source_dashboard: input.sourceDashboard === "admin" ? "admin" : "manager",
      participant_id: input.leader.participantId,
      created_minimal_participant: input.leader.createdParticipant,
      leader_kind: "primary",
    },
  });

  return null;
}

async function syncGroupPrimaryLeaderName(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  groupId: string,
  selectedPrimaryName: string | null
): Promise<string | null> {
  if (selectedPrimaryName) {
    const { error } = await supabase
      .from("groups")
      .update({ primary_leader_name: selectedPrimaryName })
      .eq("id", groupId);

    return error?.message ?? null;
  }

  const { data: primaryMembership, error: membershipError } = await supabase
    .from("group_memberships")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("is_primary", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return membershipError.message;
  }

  const primaryUserId =
    (primaryMembership as { user_id: string | null } | null)?.user_id ?? null;
  let primaryName: string | null = null;

  if (primaryUserId) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name,email")
      .eq("id", primaryUserId)
      .maybeSingle();

    if (profileError) {
      return profileError.message;
    }

    const profileRow = profile as
      | { full_name: string | null; email: string | null }
      | null;
    primaryName = profileRow?.full_name || profileRow?.email || null;
  }

  const { error } = await supabase
    .from("groups")
    .update({ primary_leader_name: primaryName })
    .eq("id", groupId);

  return error?.message ?? null;
}

function getGroupLeaderSuccessPath(sourceDashboard: string | null): string {
  if (sourceDashboard === "admin") {
    return "/dashboard/admin?section=gruppi&groupSaved=1";
  }

  return "/dashboard/manager?section=gruppi&groupSaved=1";
}

type GroupLeaderTargetResult =
  | {
      ok: true;
      participantId: string | null;
      userId: string;
      fullName: string;
      createdParticipant: boolean;
    }
  | {
      ok: false;
      error: string;
    };

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

async function hasRecentMagicLinkSend(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  eventId: string,
  emailHash: string
): Promise<boolean> {
  const since = new Date(Date.now() - MAGIC_LINK_SEND_COOLDOWN_MS).toISOString();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id")
    .eq("event_id", eventId)
    .eq("action", "email.magic_link_sent")
    .gte("created_at", since)
    .contains("metadata", { email_hash: emailHash })
    .limit(1);

  if (error) {
    console.warn(
      "email.magic_link_recent_check_failed",
      JSON.stringify({ eventId, message: error.message })
    );
    return false;
  }

  return Boolean(data?.length);
}

async function logMagicLinkSent(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  eventId: string,
  emailHash: string
): Promise<void> {
  const { error } = await supabase.from("audit_logs").insert({
    event_id: eventId,
    actor_user_id: null,
    action: "email.magic_link_sent",
    entity_table: "auth.users",
    entity_id: null,
    metadata: {
      email_hash: emailHash,
      cooldown_seconds: MAGIC_LINK_SEND_COOLDOWN_MS / 1000,
    },
  });

  if (error) {
    console.warn(
      "email.magic_link_sent_log_failed",
      JSON.stringify({ eventId, message: error.message })
    );
  }
}

function hashEmailForAudit(email: string): string {
  return createHash("sha256").update(email).digest("hex");
}

function optionalText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function normalizeEventSlug(value: FormDataEntryValue | null): string | null {
  const text = optionalText(value);

  if (!text) {
    return null;
  }

  const slug = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || null;
}

function optionalDateOnly(value: FormDataEntryValue | null): string | null {
  const text = optionalText(value);

  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function optionalDateTimeLocal(value: FormDataEntryValue | null): string | null {
  const text = optionalText(value);

  if (!text || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) {
    return null;
  }

  const date = new Date(text);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getGroupManagementDashboardPath(sourceDashboard: string | null): string {
  if (sourceDashboard === "capogruppo") {
    return "/dashboard/capogruppo";
  }

  return sourceDashboard === "admin" ? "/dashboard/admin" : "/dashboard/manager";
}

function getGroupManagementListPath(
  sourceDashboard: string | null,
  navMode?: string | null,
  extra?: string
): string {
  const basePath = getGroupManagementDashboardPath(sourceDashboard);
  const params = new URLSearchParams({ section: "gruppi" });

  if (navMode === "mini" || navMode === "full") {
    params.set("nav", navMode);
  }

  if (extra) {
    const extraParams = new URLSearchParams(extra);
    extraParams.forEach((value, key) => params.set(key, value));
  }

  return `${basePath}?${params.toString()}`;
}

function getGroupLinksModalPath(
  sourceDashboard: string | null,
  groupId: string,
  options: { saved?: boolean; token?: string; error?: string } = {}
): string {
  const isGroupLeader = sourceDashboard === "capogruppo";
  const basePath = isGroupLeader
    ? "/dashboard/capogruppo"
    : sourceDashboard === "admin"
      ? "/dashboard/admin"
      : "/dashboard/manager";
  const params = isGroupLeader
    ? new URLSearchParams({ tool: "link", groupId })
    : new URLSearchParams({
        section: "gruppi",
        groupTool: "links",
        groupId,
      });

  if (options.saved) {
    params.set("groupLinkSaved", "1");
    params.set("groupLinkGroupId", groupId);
  }

  if (options.token) {
    params.set("groupLinkToken", options.token);
  }

  if (options.error) {
    params.set("groupLinkError", options.error);
  }

  return `${basePath}?${params.toString()}`;
}

function getOperationalUsersDashboardPath(
  sourceDashboard: string | null,
  navMode?: string | null
): string {
  const basePath =
    sourceDashboard === "admin" ? "/dashboard/admin" : "/dashboard/manager";
  const params = new URLSearchParams({ section: "ruoli" });

  if (navMode === "mini" || navMode === "full") {
    params.set("nav", navMode);
  }

  return `${basePath}?${params.toString()}`;
}

function getEventServicesDashboardPath(
  sourceDashboard: string | null,
  navMode?: string | null
): string {
  const basePath =
    sourceDashboard === "admin" ? "/dashboard/admin" : "/dashboard/manager";
  const params = new URLSearchParams({ section: "impostazioni" });

  if (navMode === "mini" || navMode === "full") {
    params.set("nav", navMode);
  }

  return `${basePath}?${params.toString()}`;
}

function getParticipantServiceDashboardPath(
  sourceDashboard: string | null,
  navMode: string,
  registrationId: string | null,
  assignmentId: string | null
): string {
  if (sourceDashboard === "capogruppo") {
    const params = new URLSearchParams();

    if (assignmentId) {
      params.set("assignmentId", assignmentId);
    }

    return `/dashboard/capogruppo?${params.toString()}`;
  }

  const basePath = sourceDashboard === "admin" ? "/dashboard/admin" : "/dashboard/manager";
  const params = new URLSearchParams({
    section: "iscritti",
    nav: navMode,
  });

  if (registrationId) {
    params.set("edit", registrationId);
  }

  return `${basePath}?${params.toString()}`;
}

function getParticipantServiceSuccessPath(
  sourceDashboard: string | null,
  navMode: string,
  registrationId: string | null,
  assignmentId: string | null
): string {
  const path = getParticipantServiceDashboardPath(
    sourceDashboard,
    navMode,
    registrationId,
    assignmentId
  );
  const url = new URL(path, "https://local.invalid");

  if (sourceDashboard === "capogruppo") {
    url.searchParams.set("saved", "service");
  } else if (sourceDashboard === "admin") {
    url.searchParams.set("adminSaved", "service");
  } else {
    url.searchParams.set("managerSaved", "service");
  }

  return `${url.pathname}?${url.searchParams.toString()}`;
}

function getGroupManagementRequestedRole(
  sourceDashboard: string | null
): "admin" | "manager" | "capogruppo" {
  if (sourceDashboard === "admin") {
    return "admin";
  }

  return sourceDashboard === "capogruppo" ? "capogruppo" : "manager";
}

function isValidGroupNodeType(value: string): boolean {
  return (
    value === "country" ||
    value === "city" ||
    value === "area" ||
    value === "group" ||
    value === "newcomers"
  );
}

function isValidGroupCommunityKind(value: string): boolean {
  return (
    value === "santegidio" ||
    value === "newcomers" ||
    value === "territorial"
  );
}

function isValidGroupAgeBand(value: string): value is "giovani" | "adulti" | "anziani" {
  return value === "giovani" || value === "adulti" || value === "anziani";
}

function isAssignableOperationalRole(
  value: string | null
): value is "admin" | "manager" | "manager_viewer" | "accoglienza" | "capogruppo" {
  return (
    value === "admin" ||
    value === "manager" ||
    value === "manager_viewer" ||
    value === "accoglienza" ||
    value === "capogruppo"
  );
}

function getOperationalRoleInvitePath(
  role: "admin" | "manager" | "manager_viewer" | "accoglienza" | "capogruppo",
  email: string
): string {
  switch (role) {
    case "admin":
      return "/dashboard/admin";
    case "manager":
    case "manager_viewer":
      return "/dashboard/manager";
    case "accoglienza":
      return "/dashboard/accoglienza";
    case "capogruppo":
      return `/registrazione?email=${encodeURIComponent(email)}`;
  }
}

async function resolveOperationalRoleTarget(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  input: {
    userId: string | null;
    role: "admin" | "manager" | "manager_viewer" | "accoglienza" | "capogruppo";
    eventId: string | null;
    groupId: string | null;
  }
): Promise<
  | {
      ok: true;
      eventId: string | null;
      groupId: string | null;
      isPrimaryGroupLeader: boolean;
    }
  | { ok: false }
> {
  if (input.role === "admin") {
    return {
      ok: true,
      eventId: null,
      groupId: null,
      isPrimaryGroupLeader: false,
    };
  }

  if (input.role === "capogruppo") {
    if (!input.groupId) {
      return { ok: false };
    }

    const { data: group, error: groupError } = await supabase
      .from("groups")
      .select("id,event_id")
      .eq("id", input.groupId)
      .maybeSingle();
    const groupRow = group as { id: string; event_id: string | null } | null;

    if (groupError || !groupRow?.event_id) {
      return { ok: false };
    }

    let isPrimaryGroupLeader = false;

    if (input.userId) {
      const { data: membership } = await supabase
        .from("group_memberships")
        .select("is_primary")
        .eq("user_id", input.userId)
        .eq("group_id", input.groupId)
        .eq("role", "capogruppo")
        .maybeSingle();

      isPrimaryGroupLeader =
        ((membership as { is_primary: boolean | null } | null)?.is_primary ?? false) ===
        true;
    }

    return {
      ok: true,
      eventId: groupRow.event_id,
      groupId: groupRow.id,
      isPrimaryGroupLeader,
    };
  }

  if (!input.eventId) {
    return { ok: false };
  }

  return {
    ok: true,
    eventId: input.eventId,
    groupId: null,
    isPrimaryGroupLeader: false,
  };
}

function canManageOperationalRole(
  eventRoles: EventUserRole[],
  isAdmin: boolean,
  target: {
    role: "admin" | "manager" | "manager_viewer" | "accoglienza" | "capogruppo";
    eventId: string | null;
  }
): boolean {
  if (target.role === "admin") {
    return isAdmin;
  }

  if (isAdmin) {
    return true;
  }

  return Boolean(
    target.eventId &&
      eventRoles.some(
        (eventRole) =>
          eventRole.role === "manager" && eventRole.eventId === target.eventId
      )
  );
}

async function removeOperationalRoleAssignment(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  input: {
    userId: string;
    role: "admin" | "manager" | "manager_viewer" | "accoglienza" | "capogruppo";
    eventId: string | null;
    groupId: string | null;
  }
): Promise<string | null> {
  if (input.role === "capogruppo") {
    if (!input.groupId) {
      return "missing-group";
    }

    const { error } = await supabase
      .from("group_memberships")
      .delete()
      .eq("user_id", input.userId)
      .eq("group_id", input.groupId)
      .eq("role", "capogruppo");

    return error?.message ?? null;
  }

  const roleQuery = supabase
    .from("event_user_roles")
    .delete()
    .eq("user_id", input.userId)
    .eq("role", input.role);
  const { error } =
    input.role === "admin"
      ? await roleQuery.is("event_id", null)
      : await roleQuery.eq("event_id", input.eventId);

  return error?.message ?? null;
}

function operationalRoleSignature(input: {
  userId: string;
  role: string;
  eventId: string | null;
  groupId: string | null;
}): string {
  return [
    input.userId,
    input.role,
    input.eventId ?? "global",
    input.groupId ?? "no-group",
  ].join(":");
}

function getEventOpeningUpdate(
  intent: string,
  event: {
    status: string | null;
    registration_opens_at: string | null;
    registration_closes_at: string | null;
  },
  now: string
): Record<string, string | null> | null {
  switch (intent) {
    case "open":
      return {
        status: "published",
        registration_opens_at: now,
        registration_closes_at:
          event.registration_closes_at &&
          new Date(event.registration_closes_at).getTime() > new Date(now).getTime()
            ? event.registration_closes_at
            : null,
      };
    case "pause":
      return {
        status: "published",
        registration_closes_at: now,
      };
    case "draft":
      return {
        status: "draft",
        registration_closes_at: now,
      };
    default:
      return null;
  }
}

function relatedOne<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

async function auditGroupLeaderDecision(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  input: {
    actorUserId: string;
    action: string;
    assignment: {
      id: string;
      registration_id: string;
      group_id: string;
      status: string | null;
    };
    metadata: Record<string, unknown>;
  }
) {
  const { data: registration } = await supabase
    .from("registrations")
    .select("event_id")
    .is("deleted_at", null)
    .eq("id", input.assignment.registration_id)
    .maybeSingle();

  await supabase.from("audit_logs").insert({
    event_id:
      (registration as { event_id: string | null } | null)?.event_id ?? null,
    actor_user_id: input.actorUserId,
    action: input.action,
    entity_table: "participant_group_assignments",
    entity_id: input.assignment.id,
    metadata: {
      group_id: input.assignment.group_id,
      previous_status: input.assignment.status,
      ...input.metadata,
    },
  });
}

async function canManageGroupRegistrationLink(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  userId: string,
  eventRoles: EventUserRole[],
  groupId: string,
  eventId: string,
  sourceDashboard: string | null
): Promise<boolean> {
  const isAdmin = eventRoles.some((role) => role.role === "admin");
  const isEventManager = eventRoles.some(
    (role) => role.role === "manager" && role.eventId === eventId
  );

  if (isAdmin || isEventManager) {
    return true;
  }

  if (sourceDashboard !== "capogruppo") {
    return false;
  }

  const [{ data: memberships }, { data: groups }] = await Promise.all([
    supabase.from("group_memberships").select("group_id").eq("user_id", userId),
    supabase.from("groups").select("id,parent_group_id").eq("is_active", true),
  ]);
  const rootGroupIds = ((memberships ?? []) as Array<{ group_id: string | null }>)
    .map((membership) => membership.group_id)
    .filter((membershipGroupId): membershipGroupId is string =>
      Boolean(membershipGroupId)
    );
  const groupNodes = ((groups ?? []) as Array<{
    id: string;
    parent_group_id: string | null;
  }>).map<GroupTreeNode>((group) => ({
    id: group.id,
    parentGroupId: group.parent_group_id,
  }));

  return collectDescendantGroupIds(groupNodes, rootGroupIds).has(groupId);
}

async function logEmailFailure(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  input: {
    eventId: string | null;
    action: string;
    email: string;
    error: unknown;
  }
) {
  const message =
    input.error instanceof Error
      ? input.error.message.slice(0, 300)
      : "Errore email sconosciuto";

  await supabase.from("audit_logs").insert({
    event_id: input.eventId,
    action: input.action,
    entity_table: "participant_contacts",
    metadata: {
      email_domain: getEmailDomain(input.email),
      message,
    },
  });
}

function getEmailDomain(email: string): string | null {
  return email.split("@")[1]?.toLowerCase() ?? null;
}

function normalizeGroupLeaderContactPhone(
  value: FormDataEntryValue | string | null
): string | null {
  const text = optionalText(value);

  if (!text) {
    return null;
  }

  const compact = text.replaceAll(" ", "");
  return /^\+[1-9]\d{6,14}$/.test(compact) ? compact : text;
}

function normalizeDateOnly(value: FormDataEntryValue | string | null): string | null {
  const text = optionalText(value);
  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}
