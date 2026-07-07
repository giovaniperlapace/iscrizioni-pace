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
  const hasIdentityUpdate =
    formData.has("firstName") ||
    formData.has("lastName") ||
    formData.has("birthDate") ||
    formData.has("city") ||
    formData.has("country");
  const hasContactUpdate = formData.has("email") || formData.has("phone");
  const firstName = optionalText(formData.get("firstName"));
  const lastName = optionalText(formData.get("lastName"));
  const birthDate = normalizeDateOnly(formData.get("birthDate"));
  const city = optionalText(formData.get("city"));
  const country = optionalText(formData.get("country"));
  const email = normalizeEmail(formData.get("email"));
  const phone = optionalText(formData.get("phone"));

  if (!registrationId || !participantId) {
    return dashboardRedirect(request, redirectDashboard, "invalid-participant");
  }

  if (!groupId && !hasIdentityUpdate && !hasContactUpdate) {
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
      return dashboardRedirect(request, redirectDashboard, participantUpdateError.message);
    }

    changed.push("identity");
  }

  if (hasContactUpdate) {
    const { data: currentContacts, error: contactReadError } = await serviceSupabase
      .from("participant_contacts")
      .select("id")
      .eq("participant_id", participantId)
      .eq("is_primary", true)
      .limit(1);

    if (contactReadError) {
      return dashboardRedirect(request, redirectDashboard, contactReadError.message);
    }

    const primaryContactId =
      ((currentContacts ?? []) as Array<{ id: string }>)[0]?.id ?? null;
    const contactResult = primaryContactId
      ? await serviceSupabase
          .from("participant_contacts")
          .update({ email: email || null, phone })
          .eq("id", primaryContactId)
      : email || phone
        ? await serviceSupabase.from("participant_contacts").insert({
            participant_id: participantId,
            email: email || null,
            phone,
            is_primary: true,
          })
        : { error: null };

    if (contactResult.error) {
      return dashboardRedirect(request, redirectDashboard, contactResult.error.message);
    }

    changed.push("contact");
  }

  if (formData.has("groupId") && groupId) {
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
      identity_updated: hasIdentityUpdate,
      contact_updated: hasContactUpdate,
      has_email: Boolean(email),
      has_phone: Boolean(phone),
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

function normalizeEmail(value: FormDataEntryValue | null): string | null {
  const text = optionalText(value);

  return text ? text.toLowerCase() : null;
}

function normalizeDateOnly(value: FormDataEntryValue | null): string | null {
  const text = optionalText(value);

  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}
