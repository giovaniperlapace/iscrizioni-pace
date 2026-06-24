"use server";

import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentAuthContext, type EventUserRole } from "@/lib/auth/session";
import {
  collectDescendantGroupIds,
  getEscalationTargetGroupId,
  normalizeLeaderInternalNote,
  type GroupTreeNode,
} from "@/lib/groups/capogruppo-dashboard";
import {
  createGroupRegistrationLinkToken,
  hashGroupRegistrationLinkToken,
  normalizeGroupRegistrationPublicLabel,
} from "@/lib/groups/registration-links";
import {
  canParticipantEditRegistration,
  diffParticipantDashboardUpdate,
  parseParticipantDashboardUpdate,
  preserveAccessibilityUnlessEdited,
} from "@/lib/registrations/participant-dashboard";
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

const EMAIL_RATE_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 };
const REGISTRATION_RATE_LIMIT = { limit: 3, windowMs: 60 * 60 * 1000 };
const MAGIC_LINK_SEND_COOLDOWN_MS = 60 * 1000;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

type OperationsGroupRow = {
  id: string;
  event_id: string;
  community_kind: string | null;
  age_bracket: string | null;
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
  const parsed = parseParticipantDashboardUpdate(formData);
  const updatesAccessibility = formData.get("updatesAccessibility") === "on";

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
  const dashboardUpdate = preserveAccessibilityUnlessEdited(
    parsed.value,
    {
      accessibilityAnswers: previousAccessibility?.washington_group_answers ?? {},
      needsOperationalSupport: previousAccessibility?.needs_operational_support ?? false,
      accessibilityNotes: previousAccessibility?.operational_notes ?? null,
    },
    updatesAccessibility
  );
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
    dashboardUpdate
  );

  const writes = [
    supabase
      .from("participants")
      .update({ preferred_locale: dashboardUpdate.preferredLocale })
      .eq("id", registrationRow.participant_id),
    supabase
      .from("accessibility_needs")
      .upsert(
        {
          registration_id: registrationRow.id,
          washington_group_answers: dashboardUpdate.accessibilityAnswers,
          needs_operational_support: dashboardUpdate.needsOperationalSupport,
          operational_notes: dashboardUpdate.accessibilityNotes,
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

  const writeResults = await Promise.all(writes);
  const failedWrite = writeResults.find((result) => result.error);

  if (failedWrite?.error) {
    redirect(
      `/dashboard/partecipante?error=${encodeURIComponent(
        failedWrite.error.message
      )}`
    );
  }

  const attendanceRows = dashboardUpdate.availabilityUnknown
    ? [{ registration_id: registrationRow.id, choice: "unknown" }]
    : dashboardUpdate.availabilityDays.map((day) => ({
        registration_id: registrationRow.id,
        day,
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

export async function updateEventOpeningState(formData: FormData) {
  const eventId = optionalText(formData.get("eventId"));
  const intent = optionalText(formData.get("intent"));
  const sourceDashboard = optionalText(formData.get("sourceDashboard"));
  const dashboardPath =
    sourceDashboard === "manager" ? "/dashboard/manager" : "/dashboard/admin";

  if (!eventId || !intent) {
    redirect(`${dashboardPath}?openingError=invalid`);
  }

  const supabase = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(supabase);

  if (!auth) {
    redirect("/login");
  }

  const canManageEventOpening =
    auth.eventRoles.some((role) => role.role === "admin") ||
    auth.eventRoles.some(
      (role) => role.role === "manager" && role.eventId === eventId
    );

  if (!canManageEventOpening) {
    redirect(`${dashboardPath}?openingError=forbidden`);
  }

  const serviceSupabase = createSupabaseServiceClient();
  const { data: event, error: eventError } = await serviceSupabase
    .from("events")
    .select("id,status,registration_opens_at,registration_closes_at")
    .eq("id", eventId)
    .maybeSingle();

  if (eventError || !event) {
    redirect(`${dashboardPath}?openingError=not-found`);
  }

  const now = new Date().toISOString();
  const updates = getEventOpeningUpdate(intent, event, now);

  if (!updates) {
    redirect(`${dashboardPath}?openingError=invalid`);
  }

  const { error: updateError } = await serviceSupabase
    .from("events")
    .update(updates)
    .eq("id", eventId);

  if (updateError) {
    redirect(
      `${dashboardPath}?openingError=${encodeURIComponent(updateError.message)}`
    );
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
  redirect(`${dashboardPath}?openingSaved=1`);
}

export async function setCurrentOperationalEvent(formData: FormData) {
  const eventId = optionalText(formData.get("eventId"));

  if (!eventId) {
    redirect("/dashboard/admin?openingError=invalid");
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
    redirect("/dashboard/admin?openingError=not-found");
  }

  if (!eventRow.is_current) {
    const { error: clearError } = await serviceSupabase
      .from("events")
      .update({ is_current: false })
      .eq("is_current", true);

    if (clearError) {
      redirect(`/dashboard/admin?openingError=${encodeURIComponent(clearError.message)}`);
    }

    const { error: setError } = await serviceSupabase
      .from("events")
      .update({ is_current: true })
      .eq("id", eventRow.id);

    if (setError) {
      redirect(`/dashboard/admin?openingError=${encodeURIComponent(setError.message)}`);
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
  redirect("/dashboard/admin?section=evento&openingSaved=1");
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
    redirect("/dashboard/admin?section=evento&eventTool=new&openingError=invalid");
  }

  if (startsOn && endsOn && endsOn < startsOn) {
    redirect("/dashboard/admin?section=evento&eventTool=new&openingError=invalid-dates");
  }

  if (
    registrationOpensAt &&
    registrationClosesAt &&
    new Date(registrationClosesAt).getTime() < new Date(registrationOpensAt).getTime()
  ) {
    redirect("/dashboard/admin?section=evento&eventTool=new&openingError=invalid-dates");
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
    redirect(
      `/dashboard/admin?section=evento&eventTool=new&openingError=${encodeURIComponent(
        error?.message ?? "create"
      )}`
    );
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
  redirect("/dashboard/admin?section=evento&openingSaved=created");
}

export async function updateGroupLeaderAssignment(formData: FormData) {
  const assignmentId = optionalText(formData.get("assignmentId"));
  const intent = optionalText(formData.get("intent"));
  const note = normalizeLeaderInternalNote(formData.get("leaderInternalNote"));

  if (!assignmentId || !intent) {
    redirect("/dashboard/capogruppo?error=invalid");
  }

  const supabase = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(supabase, "capogruppo");

  if (!auth || auth.dashboardRole !== "capogruppo") {
    redirect("/login");
  }

  const serviceSupabase = createSupabaseServiceClient();
  const { data: memberships, error: membershipError } = await serviceSupabase
    .from("group_memberships")
    .select("group_id")
    .eq("user_id", auth.user.id);

  if (membershipError || !memberships?.length) {
    redirect("/dashboard/capogruppo?error=scope");
  }

  const rootGroupIds = (memberships as Array<{ group_id: string | null }>)
    .map((membership) => membership.group_id)
    .filter((groupId): groupId is string => Boolean(groupId));
  const { data: groups, error: groupsError } = await serviceSupabase
    .from("groups")
    .select("id,parent_group_id,event_id")
    .eq("is_active", true);

  if (groupsError) {
    redirect("/dashboard/capogruppo?error=groups");
  }

  const groupNodes = ((groups ?? []) as Array<{
    id: string;
    parent_group_id: string | null;
  }>).map<GroupTreeNode>((group) => ({
    id: group.id,
    parentGroupId: group.parent_group_id,
  }));
  const scopedGroupIds = collectDescendantGroupIds(groupNodes, rootGroupIds);
  const groupsById = new Map(groupNodes.map((group) => [group.id, group]));

  const { data: assignment, error: assignmentError } = await serviceSupabase
    .from("participant_group_assignments")
    .select("id,registration_id,group_id,status,is_current,escalation_depth")
    .eq("id", assignmentId)
    .maybeSingle();

  const assignmentRow = assignment as
    | {
        id: string;
        registration_id: string;
        group_id: string;
        status: string | null;
        is_current: boolean | null;
        escalation_depth: number | null;
      }
    | null;

  if (
    assignmentError ||
    !assignmentRow ||
    !scopedGroupIds.has(assignmentRow.group_id)
  ) {
    redirect("/dashboard/capogruppo?error=not-found");
  }

  const now = new Date().toISOString();

  if (intent === "note" || intent === "read") {
    const updates: Record<string, string | null> = {
      leader_notification_read_at: now,
    };

    if (intent === "note") {
      updates.leader_internal_note = note;
      updates.leader_note_updated_by = auth.user.id;
      updates.leader_note_updated_at = now;
    }

    const { error } = await serviceSupabase
      .from("participant_group_assignments")
      .update(updates)
      .eq("id", assignmentRow.id);

    if (error) {
      redirect(`/dashboard/capogruppo?error=${encodeURIComponent(error.message)}`);
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

  if (intent === "confirm") {
    const { error } = await serviceSupabase
      .from("participant_group_assignments")
      .update({
        status: "confirmed",
        is_current: true,
        confirmed_by: auth.user.id,
        confirmed_at: now,
        leader_decision_by: auth.user.id,
        leader_decision_at: now,
        leader_notification_read_at: now,
        leader_internal_note: note,
        leader_note_updated_by: note ? auth.user.id : null,
        leader_note_updated_at: note ? now : null,
      })
      .eq("id", assignmentRow.id);

    if (error) {
      redirect(`/dashboard/capogruppo?error=${encodeURIComponent(error.message)}`);
    }

    await auditGroupLeaderDecision(serviceSupabase, {
      actorUserId: auth.user.id,
      assignment: assignmentRow,
      action: "group_leader.assignment_confirmed",
      metadata: { note_changed: Boolean(note) },
    });

    revalidatePath("/dashboard/capogruppo");
    redirect("/dashboard/capogruppo?saved=1");
  }

  if (intent === "reject") {
    const parentGroupId = getEscalationTargetGroupId(
      groupsById,
      assignmentRow.group_id
    );
    const { error: rejectError } = await serviceSupabase
      .from("participant_group_assignments")
      .update({
        status: "rejected",
        is_current: false,
        leader_decision_by: auth.user.id,
        leader_decision_at: now,
        leader_notification_read_at: now,
        leader_internal_note: note,
        leader_note_updated_by: note ? auth.user.id : null,
        leader_note_updated_at: note ? now : null,
      })
      .eq("id", assignmentRow.id);

    if (rejectError) {
      redirect(
        `/dashboard/capogruppo?error=${encodeURIComponent(rejectError.message)}`
      );
    }

    if (parentGroupId) {
      const { error: escalationError } = await serviceSupabase
        .from("participant_group_assignments")
        .upsert(
          {
            registration_id: assignmentRow.registration_id,
            group_id: parentGroupId,
            status: "probable",
            source: "capogruppo",
            confidence: 0.4,
            is_current: true,
            assignment_reason: "group_leader_rejected_escalated_to_parent",
            escalated_from_group_id: assignmentRow.group_id,
            escalation_depth: (assignmentRow.escalation_depth ?? 0) + 1,
            matcher_version: "group-leader-dashboard-v1",
            leader_notification_read_at: null,
          },
          { onConflict: "registration_id,group_id" }
        );

      if (escalationError) {
        redirect(
          `/dashboard/capogruppo?error=${encodeURIComponent(
            escalationError.message
          )}`
        );
      }
    }

    await auditGroupLeaderDecision(serviceSupabase, {
      actorUserId: auth.user.id,
      assignment: assignmentRow,
      action: "group_leader.assignment_rejected",
      metadata: {
        note_changed: Boolean(note),
        escalated_to_group_id: parentGroupId,
      },
    });

    revalidatePath("/dashboard/capogruppo");
    redirect("/dashboard/capogruppo?saved=1");
  }

  redirect("/dashboard/capogruppo?error=invalid");
}

export async function createGroupLeaderManualRegistration(formData: FormData) {
  const parsed = parseManualRegistrationForm(formData);

  if (!parsed.ok) {
    redirect(
      `/dashboard/capogruppo?manualError=${encodeURIComponent(
        parsed.errors[0] ?? "invalid"
      )}`
    );
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
    redirect("/dashboard/capogruppo?manualError=forbidden");
  }

  if (
    parsed.value.email &&
    (await hasExistingRegistrationForEmail(
      serviceSupabase,
      parsed.value.email,
      groupRow.event_id
    ))
  ) {
    redirect("/dashboard/capogruppo?manualError=duplicate-email");
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
    redirect(
      `/dashboard/capogruppo?manualError=${encodeURIComponent(
        participantError?.message ?? "participant"
      )}`
    );
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
    redirect(
      `/dashboard/capogruppo?manualError=${encodeURIComponent(
        registrationError?.message ?? "registration"
      )}`
    );
  }

  const registrationId = (registration as { id: string }).id;
  const qrToken = createOpaqueQrToken();
  const eventDates = relatedOne(groupRow.events);
  const allowedEventDays = new Set(
    getEventDayValues(eventDates?.starts_on ?? null, eventDates?.ends_on ?? null)
  );

  if (
    !parsed.value.availabilityUnknown &&
    parsed.value.availabilityDays.some((day) => !allowedEventDays.has(day))
  ) {
    redirect("/dashboard/capogruppo?manualError=invalid-days");
  }

  const attendanceRows =
    parsed.value.availabilityUnknown
      ? [{ registration_id: registrationId, choice: "unknown" }]
      : parsed.value.availabilityDays.map((day) => ({
          registration_id: registrationId,
          day,
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
      accepted_by_user_id: auth.user.id,
      accepted_by_name: `${parsed.value.firstName} ${parsed.value.lastName}`.trim(),
    }),
    serviceSupabase.from("accessibility_needs").insert({
      registration_id: registrationId,
      washington_group_answers: parsed.value.accessibilityAnswers,
      needs_operational_support: parsed.value.needsOperationalSupport,
      operational_notes: parsed.value.accessibilityNotes,
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
      leader_notification_read_at: new Date().toISOString(),
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
        participant_public_code: participantRow.public_code,
      },
    }),
  ];

  if (attendanceRows.length > 0) {
    writes.push(serviceSupabase.from("event_attendance_choices").insert(attendanceRows));
  }

  const results = await Promise.all(writes);
  const failedWrite = results.find((result) => result.error);

  if (failedWrite?.error) {
    redirect(
      `/dashboard/capogruppo?manualError=${encodeURIComponent(
        failedWrite.error.message
      )}`
    );
  }

  revalidatePath("/dashboard/capogruppo");
  redirect("/dashboard/capogruppo?manualSaved=1");
}

export async function createGroupRegistrationLink(formData: FormData) {
  const groupId = optionalText(formData.get("groupId"));
  const sourceDashboard = optionalText(formData.get("sourceDashboard"));
  const dashboardPath = getGroupManagementDashboardPath(sourceDashboard);
  const publicLabel = normalizeGroupRegistrationPublicLabel(
    formData.get("displayName")
  );
  const internalLabel = publicLabel;

  if (!groupId) {
    redirect(`${dashboardPath}?groupLinkError=invalid`);
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
    .select("id,event_id,name,is_active,is_assignable")
    .eq("id", groupId)
    .maybeSingle();

  const groupRow = group as
    | {
        id: string;
        event_id: string;
        name: string | null;
        is_active: boolean | null;
        is_assignable: boolean | null;
      }
    | null;

  if (
    groupError ||
    !groupRow ||
    !groupRow.is_active ||
    !groupRow.is_assignable ||
    !(await canManageGroupRegistrationLink(serviceSupabase, auth.user.id, auth.eventRoles, groupRow.id, groupRow.event_id, sourceDashboard))
  ) {
    redirect(`${dashboardPath}?groupLinkError=forbidden`);
  }

  const token = createGroupRegistrationLinkToken();
  const { data: link, error: linkError } = await serviceSupabase
    .from("group_registration_links")
    .insert({
      event_id: groupRow.event_id,
      group_id: groupRow.id,
      token_hash: hashGroupRegistrationLinkToken(token),
      token_encrypted: encryptQrToken(token),
      public_label: publicLabel,
      internal_label: internalLabel,
      created_by: auth.user.id,
    })
    .select("id")
    .single();

  if (linkError || !link) {
    redirect(
      `${dashboardPath}?groupLinkError=${encodeURIComponent(
        linkError?.message ?? "create"
      )}`
    );
  }

  await serviceSupabase.from("audit_logs").insert({
    event_id: groupRow.event_id,
    actor_user_id: auth.user.id,
    action: "group_registration_link.created",
    entity_table: "group_registration_links",
    entity_id: (link as { id: string }).id,
    metadata: {
      group_id: groupRow.id,
      has_public_label: Boolean(publicLabel),
      has_internal_label: Boolean(internalLabel),
    },
  });

  revalidatePath("/dashboard/manager");
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/capogruppo");
  redirect(getGroupLinksModalPath(sourceDashboard, groupRow.id, {
    saved: true,
    token,
  }));
}

export async function revokeGroupRegistrationLink(formData: FormData) {
  const linkId = optionalText(formData.get("linkId"));
  const sourceDashboard = optionalText(formData.get("sourceDashboard"));
  const dashboardPath = getGroupManagementDashboardPath(sourceDashboard);

  if (!linkId) {
    redirect(`${dashboardPath}?groupLinkError=invalid`);
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
    .select("id,event_id,group_id,revoked_at")
    .eq("id", linkId)
    .maybeSingle();
  const linkRow = link as
    | {
        id: string;
        event_id: string;
        group_id: string;
        revoked_at: string | null;
      }
    | null;

  if (
    linkError ||
    !linkRow ||
    !(await canManageGroupRegistrationLink(serviceSupabase, auth.user.id, auth.eventRoles, linkRow.group_id, linkRow.event_id, sourceDashboard))
  ) {
    redirect(`${dashboardPath}?groupLinkError=forbidden`);
  }

  const now = new Date().toISOString();
  const { error: updateError } = await serviceSupabase
    .from("group_registration_links")
    .update({ revoked_at: linkRow.revoked_at ?? now, revoked_by: auth.user.id })
    .eq("id", linkRow.id);

  if (updateError) {
    redirect(
      `${dashboardPath}?groupLinkError=${encodeURIComponent(updateError.message)}`
    );
  }

  await serviceSupabase.from("audit_logs").insert({
    event_id: linkRow.event_id,
    actor_user_id: auth.user.id,
    action: "group_registration_link.revoked",
    entity_table: "group_registration_links",
    entity_id: linkRow.id,
    metadata: {
      group_id: linkRow.group_id,
      already_revoked: Boolean(linkRow.revoked_at),
    },
  });

  revalidatePath("/dashboard/manager");
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/capogruppo");
  redirect(getGroupLinksModalPath(sourceDashboard, linkRow.group_id, { saved: true }));
}

export async function saveOperationsGroup(formData: FormData) {
  const sourceDashboard = optionalText(formData.get("sourceDashboard"));
  const dashboardPath = getGroupManagementDashboardPath(sourceDashboard);
  const groupId = optionalText(formData.get("groupId"));
  const name = optionalText(formData.get("name"));
  const groupPlacement = parseGroupPlacement(formData.get("groupPlacement"));
  const parentGroupId =
    groupPlacement.parentGroupId ?? optionalText(formData.get("parentGroupId"));
  const nodeType =
    groupPlacement.nodeType ?? optionalText(formData.get("nodeType")) ?? "group";
  const primaryLeaderUserId = optionalText(formData.get("primaryLeaderUserId"));
  const primaryLeaderMode =
    primaryLeaderUserId === "__new__"
      ? "new"
      : primaryLeaderUserId
        ? "existing"
        : "none";

  if (!name || !isValidGroupNodeType(nodeType)) {
    redirect(`${dashboardPath}?groupError=invalid`);
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
    redirect(`${dashboardPath}?groupError=invalid`);
  }

  const isAdmin = auth.eventRoles.some((role) => role.role === "admin");
  const canManageEvent =
    isAdmin ||
    auth.eventRoles.some(
      (role) => role.role === "manager" && role.eventId === eventId
    );

  if (!canManageEvent || sourceDashboard === "capogruppo") {
    redirect(`${dashboardPath}?groupError=forbidden`);
  }

  let currentGroupRow: OperationsGroupRow | null = null;

  if (groupId) {
    const { data: currentGroup, error: currentGroupError } = await serviceSupabase
      .from("groups")
      .select(
        "id,event_id,community_kind,age_bracket,is_assignable,is_public_catalog,is_active,public_order"
      )
      .eq("id", groupId)
      .maybeSingle();
    currentGroupRow = currentGroup as OperationsGroupRow | null;

    if (
      currentGroupError ||
      !currentGroupRow ||
      currentGroupRow.event_id !== eventId
    ) {
      redirect(`${dashboardPath}?groupError=not-found`);
    }
  }

  if (parentGroupId) {
    const { data: parentGroup, error: parentGroupError } = await serviceSupabase
      .from("groups")
      .select("id,event_id")
      .eq("id", parentGroupId)
      .maybeSingle();
    const parentGroupRow = parentGroup as
      | { id: string; event_id: string }
      | null;

    if (
      parentGroupError ||
      !parentGroupRow ||
      parentGroupRow.event_id !== eventId ||
      parentGroupRow.id === groupId
    ) {
      redirect(`${dashboardPath}?groupError=invalid-parent`);
    }
  }

  const communityKind =
    optionalText(formData.get("communityKind")) ??
    currentGroupRow?.community_kind ??
    (nodeType === "country" || nodeType === "city" || nodeType === "area"
      ? "territorial"
      : "santegidio");
  const ageBracket =
    optionalText(formData.get("ageBracket")) ??
    currentGroupRow?.age_bracket ??
    "none";
  const isAssignable = formData.has("isAssignable")
    ? formData.get("isAssignable") === "on"
    : currentGroupRow?.is_assignable ?? true;
  const isPublicCatalog = formData.has("isPublicCatalog")
    ? isAssignable && formData.get("isPublicCatalog") === "on"
    : currentGroupRow?.is_public_catalog ?? true;
  const isActive = formData.has("isActive")
    ? formData.get("isActive") === "on"
    : currentGroupRow?.is_active ?? true;
  const publicOrder =
    currentGroupRow?.public_order ??
    (await getNextGroupPublicOrder(serviceSupabase, eventId, parentGroupId));

  if (
    !isValidGroupCommunityKind(communityKind) ||
    !isValidGroupAgeBracket(ageBracket)
  ) {
    redirect(`${dashboardPath}?groupError=invalid`);
  }

  const values = {
    event_id: eventId,
    name,
    parent_group_id: parentGroupId,
    node_type: nodeType,
    community_kind: communityKind,
    age_bracket: ageBracket,
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
    redirect(`${dashboardPath}?groupError=${encodeURIComponent(result.error.message)}`);
  }

  const savedGroupId =
    groupId || ((result.data as { id?: string } | null)?.id ?? null);

  if (!savedGroupId) {
    redirect(`${dashboardPath}?groupError=create`);
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
    redirect(`${dashboardPath}?groupError=${assignedLeader.error}`);
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
      redirect(`${dashboardPath}?groupError=${encodeURIComponent(leaderError)}`);
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

export async function assignGroupLeader(formData: FormData) {
  const sourceDashboard = optionalText(formData.get("sourceDashboard"));
  const dashboardPath = getGroupManagementDashboardPath(sourceDashboard);
  const groupId = optionalText(formData.get("groupId"));
  const mode = optionalText(formData.get("mode")) ?? "existing";
  const leaderKind = parseGroupLeaderKind(formData.get("leaderKind"));
  const isPrimaryLeader = leaderKind === "primary";

  if (!groupId || (mode !== "existing" && mode !== "new")) {
    redirect(`${dashboardPath}?groupError=invalid`);
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
    redirect(`${dashboardPath}?groupError=not-found`);
  }

  const isAdmin = auth.eventRoles.some((role) => role.role === "admin");
  const canManageEvent =
    isAdmin ||
    auth.eventRoles.some(
      (role) => role.role === "manager" && role.eventId === groupRow.event_id
    );

  if (!canManageEvent || sourceDashboard === "capogruppo") {
    redirect(`${dashboardPath}?groupError=forbidden`);
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
    redirect(`${dashboardPath}?groupError=${leader.error}`);
  }

  if (isPrimaryLeader) {
    const demoteError = await demoteOtherPrimaryGroupLeaders(
      serviceSupabase,
      groupRow.id,
      leader.userId
    );

    if (demoteError) {
      redirect(`${dashboardPath}?groupError=${encodeURIComponent(demoteError)}`);
    }
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
    redirect(
      `${dashboardPath}?groupError=${encodeURIComponent(membership.error.message)}`
    );
  }

  const syncError = await syncGroupPrimaryLeaderName(
    serviceSupabase,
    groupRow.id,
    isPrimaryLeader ? leader.fullName : null
  );

  if (syncError) {
    redirect(`${dashboardPath}?groupError=${encodeURIComponent(syncError)}`);
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
    redirect(`${dashboardPath}&roleError=invalid`);
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
    redirect(`${dashboardPath}&roleError=forbidden`);
  }

  let roleEventId: string | null = null;
  let roleGroupId: string | null = null;

  if (role === "capogruppo") {
    if (!groupId) {
      redirect(`${dashboardPath}&roleError=missing-group`);
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
      redirect(`${dashboardPath}&roleError=invalid-group`);
    }

    const canManageGroupEvent =
      isAdmin ||
      auth.eventRoles.some(
        (eventRole) =>
          eventRole.role === "manager" && eventRole.eventId === groupRow.event_id
      );

    if (!canManageGroupEvent) {
      redirect(`${dashboardPath}&roleError=forbidden`);
    }

    roleEventId = groupRow.event_id;
    roleGroupId = groupRow.id;
  } else if (role !== "admin") {
    if (!currentEventId) {
      redirect(`${dashboardPath}&roleError=missing-event`);
    }

    const canManageRoleEvent =
      isAdmin ||
      auth.eventRoles.some(
        (eventRole) =>
          eventRole.role === "manager" && eventRole.eventId === currentEventId
      );

    if (!canManageRoleEvent) {
      redirect(`${dashboardPath}&roleError=forbidden`);
    }

    roleEventId = currentEventId;
  }

  const userId = await ensureAuthUserForGroupLeader(serviceSupabase, {
    email,
    fullName,
  });

  if (!userId) {
    redirect(`${dashboardPath}&roleError=auth-user`);
  }

  await syncOperationalIdentityByEmail(serviceSupabase, {
    email,
    firstName,
    lastName,
    userId,
  });

  if (role === "capogruppo") {
    if (!roleGroupId) {
      redirect(`${dashboardPath}&roleError=missing-group`);
    }

    if (isPrimaryLeader) {
      const demoteError = await demoteOtherPrimaryGroupLeaders(
        serviceSupabase,
        roleGroupId,
        userId
      );

      if (demoteError) {
        redirect(`${dashboardPath}&roleError=${encodeURIComponent(demoteError)}`);
      }
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
      redirect(
        `${dashboardPath}&roleError=${encodeURIComponent(membership.error.message)}`
      );
    }

    const syncError = await syncGroupPrimaryLeaderName(
      serviceSupabase,
      roleGroupId,
      isPrimaryLeader ? fullName : null
    );

    if (syncError) {
      redirect(`${dashboardPath}&roleError=${encodeURIComponent(syncError)}`);
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
      redirect(`${dashboardPath}&roleError=${encodeURIComponent(selectError.message)}`);
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
        redirect(
          `${dashboardPath}&roleError=${encodeURIComponent(insertError.message)}`
        );
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

      redirect(`${dashboardPath}&roleError=invite-email`);
    }
  }

  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/manager");
  revalidatePath("/dashboard/capogruppo");
  redirect(`${dashboardPath}&roleSaved=1`);
}

export async function updateOperationalUserRole(formData: FormData) {
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
  const leaderKind = parseGroupLeaderKind(formData.get("leaderKind"));
  const isPrimaryLeader = leaderKind === "primary";

  if (
    !currentUserId ||
    !isAssignableOperationalRole(currentRole) ||
    !firstName ||
    !lastName ||
    !email ||
    !isAssignableOperationalRole(role)
  ) {
    redirect(`${dashboardPath}&roleError=invalid`);
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
    redirect(`${dashboardPath}&roleError=invalid`);
  }

  if (
    !canManageOperationalRole(auth.eventRoles, isAdmin, {
      role: currentRole,
      eventId: currentTarget.eventId,
    })
  ) {
    redirect(`${dashboardPath}&roleError=forbidden`);
  }

  const nextTarget = await resolveOperationalRoleTarget(serviceSupabase, {
    userId: null,
    role,
    eventId: role === "admin" || role === "capogruppo" ? eventId : currentOperationalEventId,
    groupId,
  });

  if (!nextTarget.ok) {
    redirect(`${dashboardPath}&roleError=invalid`);
  }

  if (
    !canManageOperationalRole(auth.eventRoles, isAdmin, {
      role,
      eventId: nextTarget.eventId,
    })
  ) {
    redirect(`${dashboardPath}&roleError=forbidden`);
  }

  const fullName = `${firstName} ${lastName}`.trim();
  const targetUserId = await ensureAuthUserForGroupLeader(serviceSupabase, {
    email,
    fullName,
  });

  if (!targetUserId) {
    redirect(`${dashboardPath}&roleError=auth-user`);
  }

  await syncOperationalIdentityByEmail(serviceSupabase, {
    email,
    firstName,
    lastName,
    userId: targetUserId,
  });

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
    redirect(`${dashboardPath}&roleError=self-role`);
  }

  if (currentSignature !== nextSignature) {
    const removeError = await removeOperationalRoleAssignment(serviceSupabase, {
      userId: currentUserId,
      role: currentRole,
      eventId: currentRole === "admin" ? null : currentTarget.eventId,
      groupId: currentTarget.groupId,
    });

    if (removeError) {
      redirect(`${dashboardPath}&roleError=${encodeURIComponent(removeError)}`);
    }

    if (currentTarget.isPrimaryGroupLeader && currentTarget.groupId) {
      const syncError = await syncGroupPrimaryLeaderName(
        serviceSupabase,
        currentTarget.groupId,
        null
      );

      if (syncError) {
        redirect(`${dashboardPath}&roleError=${encodeURIComponent(syncError)}`);
      }
    }
  }

  if (role === "capogruppo") {
    if (!nextTarget.groupId) {
      redirect(`${dashboardPath}&roleError=missing-group`);
    }

    if (isPrimaryLeader) {
      const demoteError = await demoteOtherPrimaryGroupLeaders(
        serviceSupabase,
        nextTarget.groupId,
        targetUserId
      );

      if (demoteError) {
        redirect(`${dashboardPath}&roleError=${encodeURIComponent(demoteError)}`);
      }
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
      redirect(
        `${dashboardPath}&roleError=${encodeURIComponent(membership.error.message)}`
      );
    }

    const syncError = await syncGroupPrimaryLeaderName(
      serviceSupabase,
      nextTarget.groupId,
      isPrimaryLeader ? fullName : null
    );

    if (syncError) {
      redirect(`${dashboardPath}&roleError=${encodeURIComponent(syncError)}`);
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
      redirect(`${dashboardPath}&roleError=${encodeURIComponent(selectError.message)}`);
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
        redirect(
          `${dashboardPath}&roleError=${encodeURIComponent(insertError.message)}`
        );
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
    redirect(`${dashboardPath}&roleError=invalid`);
  }

  const supabase = await createSupabaseServerClient();
  const requestedRole = sourceDashboard === "admin" ? "admin" : "manager";
  const auth = await getCurrentAuthContext(supabase, requestedRole);

  if (!auth) {
    redirect("/login");
  }

  if (userId === auth.user.id) {
    redirect(`${dashboardPath}&roleError=self-role`);
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
    redirect(`${dashboardPath}&roleError=invalid`);
  }

  if (
    !canManageOperationalRole(auth.eventRoles, isAdmin, {
      role,
      eventId: target.eventId,
    })
  ) {
    redirect(`${dashboardPath}&roleError=forbidden`);
  }

  const removeError = await removeOperationalRoleAssignment(serviceSupabase, {
    userId,
    role,
    eventId: role === "admin" ? null : target.eventId,
    groupId: target.groupId,
  });

  if (removeError) {
    redirect(`${dashboardPath}&roleError=${encodeURIComponent(removeError)}`);
  }

  if (target.isPrimaryGroupLeader && target.groupId) {
    const syncError = await syncGroupPrimaryLeaderName(
      serviceSupabase,
      target.groupId,
      null
    );

    if (syncError) {
      redirect(`${dashboardPath}&roleError=${encodeURIComponent(syncError)}`);
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
  const demoteError = await demoteOtherPrimaryGroupLeaders(
    supabase,
    input.groupId,
    input.leader.userId
  );

  if (demoteError) {
    return demoteError;
  }

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

async function demoteOtherPrimaryGroupLeaders(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  groupId: string,
  selectedUserId: string
): Promise<string | null> {
  const { error } = await supabase
    .from("group_memberships")
    .update({ is_primary: false })
    .eq("group_id", groupId)
    .eq("is_primary", true)
    .neq("user_id", selectedUserId);

  return error?.message ?? null;
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

function parseGroupPlacement(value: FormDataEntryValue | null): {
  nodeType: string | null;
  parentGroupId: string | null;
} {
  const text = optionalText(value);

  if (!text) {
    return { nodeType: null, parentGroupId: null };
  }

  const [nodeType, parentGroupId = ""] = text.split(":");

  if (!isValidGroupNodeType(nodeType)) {
    return { nodeType: null, parentGroupId: null };
  }

  return {
    nodeType,
    parentGroupId: parentGroupId || null,
  };
}

function getGroupManagementDashboardPath(sourceDashboard: string | null): string {
  if (sourceDashboard === "capogruppo") {
    return "/dashboard/capogruppo";
  }

  return sourceDashboard === "admin" ? "/dashboard/admin" : "/dashboard/manager";
}

function getGroupLinksModalPath(
  sourceDashboard: string | null,
  groupId: string,
  options: { saved?: boolean; token?: string } = {}
): string {
  const basePath =
    sourceDashboard === "admin" ? "/dashboard/admin" : "/dashboard/manager";
  const params = new URLSearchParams({
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

function isValidGroupAgeBracket(value: string): boolean {
  return (
    value === "giovani" ||
    value === "adulti" ||
    value === "both" ||
    value === "none"
  );
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

function getEventDayValues(startsOn: string | null, endsOn: string | null): string[] {
  if (!startsOn) {
    return [];
  }

  const start = parseDateOnly(startsOn);
  const end = parseDateOnly(endsOn ?? startsOn);

  if (!start || !end || end.getTime() < start.getTime()) {
    return [];
  }

  const days: string[] = [];

  for (
    let cursor = start;
    cursor.getTime() <= end.getTime();
    cursor = new Date(cursor.getTime() + DAY_IN_MS)
  ) {
    days.push(cursor.toISOString().slice(0, 10));
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
