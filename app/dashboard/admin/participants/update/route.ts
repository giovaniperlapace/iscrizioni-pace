import { NextResponse, type NextRequest } from "next/server";

import { getCurrentAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const registrationId = optionalText(formData.get("registrationId"));
  const participantId = optionalText(formData.get("participantId"));
  const groupId = optionalText(formData.get("groupId"));
  const sourceDashboard = optionalText(formData.get("sourceDashboard"));
  const redirectDashboard = sourceDashboard === "manager" ? "manager" : "admin";

  if (!registrationId || !participantId) {
    return dashboardRedirect(request, redirectDashboard, "invalid-participant");
  }

  if (!groupId) {
    return dashboardRedirect(request, redirectDashboard, null, true);
  }

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
