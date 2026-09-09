import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return NextResponse.json(
      { error: "Origine non consentita." },
      { status: 403 },
    );
  const data = await request.formData();
  const dashboard =
    data.get("sourceDashboard") === "admin" ? "admin" : "manager";
  const auth = await getCurrentAuthContext(
    await createSupabaseServerClient(),
    dashboard,
  );
  if (!auth)
    return NextResponse.json(
      { error: "Sessione scaduta. Accedi nuovamente." },
      { status: 401 },
    );
  const field = data.get("field");
  if (!["group", "service", "tags"].includes(String(field)))
    return NextResponse.json(
      { error: "Operazione non valida." },
      { status: 422 },
    );
  const { error } = await createSupabaseServiceClient().rpc(
    "update_registration_operation",
    {
      p_registration_id: data.get("registrationId"),
      p_participant_id: data.get("participantId"),
      p_actor_user_id: auth.user.id,
      p_field: field,
      p_value:
        field === "tags" ? data.getAll("value") : [data.get("value") ?? ""],
    },
  );
  if (error)
    return NextResponse.json(
      {
        error:
          error.code === "42501"
            ? "Non hai i permessi per questa modifica."
            : "Salvataggio non riuscito. Verifica che l’iscrizione e le opzioni siano ancora disponibili e riprova.",
      },
      { status: 422 },
    );
  for (const path of [
    "/dashboard/admin",
    "/dashboard/manager",
    "/dashboard/capogruppo",
    "/dashboard/partecipante",
  ])
    revalidatePath(path);
  return NextResponse.json({ ok: true });
}
