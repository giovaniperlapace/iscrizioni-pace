"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
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
const MAGIC_LINK_SEND_COOLDOWN_MS = 60 * 1000;

export async function logout() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  redirect("/");
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

  const exists = await hasExistingRegistrationForEmail(supabase, email, event.id);

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

export async function createGroupRegistrationLink(formData: FormData) {
  const groupId = optionalText(formData.get("groupId"));
  const sourceDashboard = optionalText(formData.get("sourceDashboard"));
  const dashboardPath =
    sourceDashboard === "capogruppo" ? "/dashboard/capogruppo" : "/dashboard/manager";
  const publicLabel = normalizeGroupRegistrationPublicLabel(
    formData.get("publicLabel")
  );
  const internalLabel = normalizeGroupRegistrationPublicLabel(
    formData.get("internalLabel")
  );

  if (!groupId) {
    redirect(`${dashboardPath}?groupLinkError=invalid`);
  }

  const supabase = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(
    supabase,
    sourceDashboard === "capogruppo" ? "capogruppo" : "manager"
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
  revalidatePath("/dashboard/capogruppo");
  redirect(
    `${dashboardPath}?groupLinkSaved=1&groupLinkToken=${encodeURIComponent(
      token
    )}&groupLinkGroupId=${encodeURIComponent(groupRow.id)}`
  );
}

export async function revokeGroupRegistrationLink(formData: FormData) {
  const linkId = optionalText(formData.get("linkId"));
  const sourceDashboard = optionalText(formData.get("sourceDashboard"));
  const dashboardPath =
    sourceDashboard === "capogruppo" ? "/dashboard/capogruppo" : "/dashboard/manager";

  if (!linkId) {
    redirect(`${dashboardPath}?groupLinkError=invalid`);
  }

  const supabase = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(
    supabase,
    sourceDashboard === "capogruppo" ? "capogruppo" : "manager"
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
  revalidatePath("/dashboard/capogruppo");
  redirect(`${dashboardPath}?groupLinkSaved=1`);
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
    eventId: string;
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
