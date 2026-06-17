import { NextResponse, type NextRequest } from "next/server";

import { getCurrentAuthContext } from "@/lib/auth/session";
import { normalizeEmail } from "@/lib/registrations/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

type AdminAssignableRole =
  | "admin"
  | "manager"
  | "manager_viewer"
  | "accoglienza"
  | "capogruppo";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const registrationId = optionalText(formData.get("registrationId"));
  const participantId = optionalText(formData.get("participantId"));
  const groupId = optionalText(formData.get("groupId"));
  const role = optionalText(formData.get("role"));
  const roleWasSubmitted = formData.has("role");
  const email = normalizeEmail(formData.get("email"));
  const fullName = optionalText(formData.get("fullName"));
  const sourceDashboard = optionalText(formData.get("sourceDashboard"));
  const redirectDashboard = sourceDashboard === "manager" ? "manager" : "admin";

  if (!registrationId || !participantId) {
    return dashboardRedirect(request, redirectDashboard, "invalid-participant");
  }

  if (!groupId && !roleWasSubmitted) {
    return dashboardRedirect(request, redirectDashboard, null, true);
  }

  if (role && !isAssignableAdminRole(role)) {
    return dashboardRedirect(request, redirectDashboard, "invalid-role");
  }
  const assignableRole = isAssignableAdminRole(role) ? role : null;

  const supabase = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(supabase, redirectDashboard);

  if (!auth) {
    return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  }

  const actorIsAdmin = auth.eventRoles.some((eventRole) => eventRole.role === "admin");
  const serviceSupabase = createSupabaseServiceClient();
  const { data: registration, error: registrationError } = await serviceSupabase
    .from("registrations")
    .select("id,event_id,participant_id")
    .eq("id", registrationId)
    .maybeSingle();
  const registrationRow = registration as
    | { id: string; event_id: string; participant_id: string }
    | null;

  if (
    registrationError ||
    !registrationRow ||
    registrationRow.participant_id !== participantId
  ) {
    return dashboardRedirect(request, redirectDashboard, "invalid-participant");
  }

  const actorCanManageEvent =
    actorIsAdmin ||
    auth.eventRoles.some(
      (eventRole) =>
        eventRole.role === "manager" && eventRole.eventId === registrationRow.event_id
    );

  if (!actorCanManageEvent) {
    return dashboardRedirect(request, redirectDashboard, "forbidden");
  }

  if (
    !actorIsAdmin &&
    (assignableRole === "admin" || assignableRole === "manager")
  ) {
    return dashboardRedirect(request, redirectDashboard, "protected-role");
  }

  const now = new Date().toISOString();
  const changed: string[] = [];

  if (groupId) {
    const groupResult = await updateCurrentGroup({
      supabase: serviceSupabase,
      registrationId,
      groupId,
      eventId: registrationRow.event_id,
      actorUserId: auth.user.id,
      actorSource: actorIsAdmin ? "admin" : "manager",
      now,
    });

    if (groupResult) {
      return dashboardRedirect(request, redirectDashboard, groupResult);
    }

    changed.push("group");
  }

  if (roleWasSubmitted) {
    const roleResult = await updateOperationalRole({
      supabase: serviceSupabase,
      participantId,
      eventId: registrationRow.event_id,
      role: assignableRole,
      groupId,
      email,
      fullName,
      actorUserId: auth.user.id,
      actorCanAssignManagers: actorIsAdmin,
    });

    if (roleResult) {
      return dashboardRedirect(request, redirectDashboard, roleResult);
    }

    changed.push("role");
  }

  await serviceSupabase.from("audit_logs").insert({
    event_id: registrationRow.event_id,
    actor_user_id: auth.user.id,
    action: actorIsAdmin
      ? "admin.participant_operations_updated"
      : "manager.participant_operations_updated",
    entity_table: "registrations",
    entity_id: registrationId,
    metadata: {
      changed,
      group_id: groupId,
      role: assignableRole,
    },
  });

  return dashboardRedirect(request, redirectDashboard, null, true);
}

async function updateCurrentGroup({
  supabase,
  registrationId,
  groupId,
  eventId,
  actorUserId,
  actorSource,
  now,
}: {
  supabase: ReturnType<typeof createSupabaseServiceClient>;
  registrationId: string;
  groupId: string;
  eventId: string;
  actorUserId: string;
  actorSource: "admin" | "manager";
  now: string;
}): Promise<string | null> {
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("id,event_id")
    .eq("id", groupId)
    .maybeSingle();
  const groupRow = group as { id: string; event_id: string } | null;

  if (groupError || !groupRow || groupRow.event_id !== eventId) {
    return "invalid-group";
  }

  await supabase
    .from("participant_group_assignments")
    .update({ is_current: false })
    .eq("registration_id", registrationId)
    .eq("is_current", true);

  const { data: existingAssignment } = await supabase
    .from("participant_group_assignments")
    .select("id")
    .eq("registration_id", registrationId)
    .eq("group_id", groupId)
    .maybeSingle();
  const assignmentValues = {
    registration_id: registrationId,
    group_id: groupId,
    status: "confirmed",
    source: actorSource,
    confidence: 1,
    confirmed_by: actorUserId,
    confirmed_at: now,
    is_current: true,
    assignment_reason: `${actorSource}_updated_group`,
    matcher_version: `${actorSource}-dashboard-v1`,
  };
  const result = existingAssignment
    ? await supabase
        .from("participant_group_assignments")
        .update(assignmentValues)
        .eq("id", (existingAssignment as { id: string }).id)
    : await supabase.from("participant_group_assignments").insert(assignmentValues);

  return result.error?.message ?? null;
}

async function updateOperationalRole({
  supabase,
  participantId,
  eventId,
  role,
  groupId,
  email,
  fullName,
  actorUserId,
  actorCanAssignManagers,
}: {
  supabase: ReturnType<typeof createSupabaseServiceClient>;
  participantId: string;
  eventId: string;
  role: AdminAssignableRole | null;
  groupId: string | null;
  email: string | null;
  fullName: string | null;
  actorUserId: string;
  actorCanAssignManagers: boolean;
}): Promise<string | null> {
  const { data: participant, error: participantError } = await supabase
    .from("participants")
    .select("id,auth_user_id")
    .eq("id", participantId)
    .maybeSingle();
  const participantRow = participant as
    | { id: string; auth_user_id: string | null }
    | null;

  if (participantError || !participantRow) {
    return "invalid-participant";
  }

  const targetUserId =
    participantRow.auth_user_id ??
    (await ensureAuthUserForAdminRole(supabase, { email, fullName }));

  if (!targetUserId) {
    return "missing-email";
  }

  if (!participantRow.auth_user_id) {
    const { error: linkError } = await supabase
      .from("participants")
      .update({ auth_user_id: targetUserId })
      .eq("id", participantId);

    if (linkError) {
      return linkError.message;
    }
  }

  const eventRolesToDelete = actorCanAssignManagers
    ? ["manager", "manager_viewer", "accoglienza"]
    : ["manager_viewer", "accoglienza"];

  const { error: deleteEventRoleError } = await supabase
    .from("event_user_roles")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", targetUserId)
    .in("role", eventRolesToDelete);

  if (deleteEventRoleError) {
    return deleteEventRoleError.message;
  }

  if (actorCanAssignManagers) {
    const { error: deleteAdminRoleError } = await supabase
      .from("event_user_roles")
      .delete()
      .is("event_id", null)
      .eq("user_id", targetUserId)
      .eq("role", "admin");

    if (deleteAdminRoleError) {
      return deleteAdminRoleError.message;
    }
  }

  const { data: eventGroups, error: groupsError } = await supabase
    .from("groups")
    .select("id")
    .eq("event_id", eventId);

  if (groupsError) {
    return groupsError.message;
  }

  const eventGroupIds = ((eventGroups ?? []) as Array<{ id: string | null }>)
    .map((group) => group.id)
    .filter((id): id is string => Boolean(id));

  if (eventGroupIds.length > 0) {
    const { error: deleteMembershipError } = await supabase
      .from("group_memberships")
      .delete()
      .eq("user_id", targetUserId)
      .in("group_id", eventGroupIds);

    if (deleteMembershipError) {
      return deleteMembershipError.message;
    }
  }

  if (!role) {
    return null;
  }

  if (role === "capogruppo") {
    if (!groupId || !eventGroupIds.includes(groupId)) {
      return "invalid-group";
    }

    const { error: membershipError } = await supabase
      .from("group_memberships")
      .insert({
        group_id: groupId,
        user_id: targetUserId,
        role,
        created_by: actorUserId,
      });

    return membershipError?.message ?? null;
  }

  if (role === "admin" || role === "manager") {
    if (!actorCanAssignManagers) {
      return "protected-role";
    }
  }

  if (role === "admin") {
    const { error: roleError } = await supabase.from("event_user_roles").insert({
      event_id: null,
      user_id: targetUserId,
      role,
      created_by: actorUserId,
    });

    return roleError?.message ?? null;
  }

  const { error: roleError } = await supabase.from("event_user_roles").insert({
    event_id: eventId,
    user_id: targetUserId,
    role,
    created_by: actorUserId,
  });

  return roleError?.message ?? null;
}

async function ensureAuthUserForAdminRole(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  input: {
    email: string | null;
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
    await supabase.from("profiles").upsert(
      {
        id: created.user.id,
        email: input.email,
        full_name: input.fullName,
      },
      { onConflict: "id" }
    );

    return created.user.id;
  }

  const message = createError?.message ?? "";

  if (!/already|registered|exists/i.test(message)) {
    return message || "auth-user";
  }

  const { data: users, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listError) {
    return listError.message;
  }

  const existing = users.users.find(
    (user) => user.email?.toLowerCase() === input.email
  );

  if (!existing) {
    return "auth-user";
  }

  await supabase.from("profiles").upsert(
    {
      id: existing.id,
      email: input.email,
      full_name: input.fullName,
    },
    { onConflict: "id" }
  );

  return existing.id;
}

function dashboardRedirect(
  request: NextRequest,
  dashboard: "admin" | "manager",
  error: string | null,
  saved = false
): NextResponse {
  const prefix = dashboard === "manager" ? "manager" : "admin";
  const query = saved
    ? `${prefix}Saved=1`
    : `${prefix}Error=${encodeURIComponent(error ?? "invalid")}`;

  return NextResponse.redirect(
    new URL(`/dashboard/${dashboard}?${query}`, request.url),
    {
      status: 303,
    }
  );
}

function optionalText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function isAssignableAdminRole(
  value: string | null
): value is AdminAssignableRole {
  return (
    value === "admin" ||
    value === "manager" ||
    value === "manager_viewer" ||
    value === "accoglienza" ||
    value === "capogruppo"
  );
}
