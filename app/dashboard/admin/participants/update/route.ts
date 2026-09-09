import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import {
  formFailure,
  formFailureFromRedirect,
  validateContactFields,
} from "@/lib/forms/result";
import { getCurrentAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { operationsReturnPath } from "@/lib/registrations/operations-table";

export async function POST(request: NextRequest) {
  const data = await request.formData();
  const dashboard =
    data.get("sourceDashboard") === "manager" ? "manager" : "admin";
  const returnTo = operationsReturnPath(
    data.get("returnTo"),
    dashboard,
    String(data.get("nav")),
  );
  const respond = (error: string | null) => {
    const params = new URL(returnTo, request.url);
    params.searchParams.set(
      error ? `${dashboard}Error` : `${dashboard}Saved`,
      error ?? "1",
    );
    const destination = params.pathname + params.search;
    return request.headers.get("accept")?.includes("application/json")
      ? NextResponse.json(
          error
            ? formFailureFromRedirect(destination)
            : { redirect: destination },
          { status: error ? 422 : 200 },
        )
      : NextResponse.redirect(params, { status: 303 });
  };
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return respond("forbidden");
  const issues = validateContactFields(data);
  if (issues.length)
    return NextResponse.json(formFailure(issues), { status: 422 });
  const auth = await getCurrentAuthContext(
    await createSupabaseServerClient(),
    dashboard,
  );
  if (!auth) return respond("forbidden");
  const field = data.has("groupId") ? "group" : "identity";
  const value: Record<string, string | null> = {};
  for (const key of [
    "firstName",
    "lastName",
    "birthDate",
    "city",
    "country",
    "email",
    "phone",
  ]) {
    if (data.has(key)) value[key] = String(data.get(key) ?? "").trim() || null;
  }
  const { error } = await createSupabaseServiceClient().rpc(
    "update_registration_operation",
    {
      p_registration_id: data.get("registrationId"),
      p_participant_id: data.get("participantId"),
      p_actor_user_id: auth.user.id,
      p_field: field,
      p_value: field === "group" ? [data.get("groupId") ?? ""] : value,
    },
  );
  if (error)
    return respond(
      error.code === "42501" ? "forbidden" : "invalid-participant",
    );
  for (const path of [
    "/dashboard/admin",
    "/dashboard/manager",
    "/dashboard/partecipante",
    "/dashboard/capogruppo",
  ])
    revalidatePath(path);
  return respond(null);
}
