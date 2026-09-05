import { NextResponse, type NextRequest } from "next/server";

import { formFailureFromRedirect } from "@/lib/forms/result";

import { getCurrentAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const registrationId = optionalText(formData.get("registrationId"));
  const participantId = optionalText(formData.get("participantId"));
  const sourceDashboard = formData.get("sourceDashboard") === "manager" ? "manager" : "admin";
  const navMode = formData.get("nav") === "mini" ? "mini" : "full";

  if (!registrationId || !participantId) {
    return dashboardRedirect(request, sourceDashboard, navMode, "invalid-participant");
  }

  const supabase = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(supabase, sourceDashboard);

  if (!auth) {
    return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  }

  const serviceSupabase = createSupabaseServiceClient();
  const { data: registration, error: registrationError } = await serviceSupabase
    .from("registrations")
    .select("id,event_id,participant_id,status")
    .eq("id", registrationId)
    .maybeSingle();
  const registrationRow = registration as
    | {
        id: string;
        event_id: string;
        participant_id: string;
        status: string;
      }
    | null;

  if (
    registrationError ||
    !registrationRow ||
    registrationRow.participant_id !== participantId
  ) {
    return dashboardRedirect(request, sourceDashboard, navMode, "invalid-participant");
  }

  const actorIsAdmin = auth.eventRoles.some((eventRole) => eventRole.role === "admin");
  const actorCanManageEvent =
    actorIsAdmin ||
    auth.eventRoles.some(
      (eventRole) =>
        eventRole.role === "manager" && eventRole.eventId === registrationRow.event_id
    );

  if (!actorCanManageEvent) {
    return dashboardRedirect(request, sourceDashboard, navMode, "forbidden");
  }

  const { data: deletedRegistration, error: deleteError } = await serviceSupabase
    .from("registrations")
    .delete()
    .eq("id", registrationId)
    .eq("participant_id", participantId)
    .select("id")
    .maybeSingle();

  if (deleteError || !deletedRegistration) {
    console.error("[operations:registration-delete]", {
      code: deleteError?.code,
      message: deleteError?.message,
      registrationId,
    });
    return dashboardRedirect(request, sourceDashboard, navMode, "delete-failed");
  }

  const { error: auditError } = await serviceSupabase.from("audit_logs").insert({
    event_id: registrationRow.event_id,
    actor_user_id: auth.user.id,
    action: actorIsAdmin
      ? "admin.registration_deleted"
      : "manager.registration_deleted",
    entity_table: "registrations",
    entity_id: registrationId,
    metadata: {
      participant_id: participantId,
      previous_status: registrationRow.status,
      participant_record_retained: true,
      auth_account_retained: true,
      source_dashboard: sourceDashboard,
    },
  });

  if (auditError) {
    console.error("[operations:registration-delete-audit]", {
      code: auditError.code,
      message: auditError.message,
      registrationId,
    });
  }

  return dashboardRedirect(request, sourceDashboard, navMode, null, "deleted");
}

function dashboardRedirect(
  request: NextRequest,
  dashboard: "admin" | "manager",
  navMode: "full" | "mini",
  error: string | null,
  saved?: "deleted"
): NextResponse {
  const result = saved
    ? `${dashboard}Saved=${saved}`
    : `${dashboard}Error=${encodeURIComponent(error ?? "invalid")}`;

  if (request.headers.get("accept")?.includes("application/json")) {
    const destination = `/dashboard/${dashboard}?section=iscritti&nav=${navMode}&${result}`;
    return NextResponse.json(saved ? { redirect: destination } : formFailureFromRedirect(destination), { status: saved ? 200 : 422 });
  }
  return NextResponse.redirect(
    new URL(
      `/dashboard/${dashboard}?section=iscritti&nav=${navMode}&${result}`,
      request.url
    ),
    { status: 303 }
  );
}

function optionalText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}
