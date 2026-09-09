import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { formFailureFromRedirect } from "@/lib/forms/result";
import { getCurrentAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { operationsReturnPath } from "@/lib/registrations/operations-table";

export async function POST(request: NextRequest) {
  const data = await request.formData();
  const dashboard =
    data.get("sourceDashboard") === "manager" ? "manager" : "admin";
  const nav = data.get("nav") === "mini" ? "mini" : "full";
  const destination = new URL(
    operationsReturnPath(data.get("returnTo"), dashboard, nav),
    request.url,
  );
  destination.searchParams.delete("edit");
  const restore = data.get("intent") === "restore";
  const respond = (error: string | null) => {
    destination.searchParams.set(
      error ? `${dashboard}Error` : `${dashboard}Saved`,
      error ?? (restore ? "restored" : "deleted"),
    );
    const path = destination.pathname + destination.search;
    return request.headers.get("accept")?.includes("application/json")
      ? NextResponse.json(
          error ? formFailureFromRedirect(path) : { redirect: path },
          { status: error ? 422 : 200 },
        )
      : NextResponse.redirect(destination, { status: 303 });
  };
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return respond("forbidden");
  if (data.get("confirmLifecycle") !== "on") return respond("invalid");
  const auth = await getCurrentAuthContext(
    await createSupabaseServerClient(),
    dashboard,
  );
  if (!auth) return respond("forbidden");
  // The RPC independently validates manager event scope / admin-only restore,
  // locks the registration and commits lifecycle, QR, queue and audit together.
  const { error } = await createSupabaseServiceClient().rpc(
    "set_registration_deleted",
    {
      p_registration_id: data.get("registrationId"),
      p_participant_id: data.get("participantId"),
      p_actor_user_id: auth.user.id,
      p_reason: data.get("reason"),
      p_restore: restore,
    },
  );
  if (error)
    return respond(error.code === "42501" ? "forbidden" : "delete-failed");
  for (const path of [
    "/dashboard/admin",
    "/dashboard/manager",
    "/dashboard/capogruppo",
    "/dashboard/partecipante",
  ])
    revalidatePath(path);
  return respond(null);
}
