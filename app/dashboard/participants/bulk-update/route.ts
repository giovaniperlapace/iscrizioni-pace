import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return NextResponse.json({ error: "Origine non consentita." }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.eventId !== "string" || typeof body.value !== "string" || !uuid.test(body.eventId) || !uuid.test(body.value) ||
    !["tags", "group", "service", "delete-tag"].includes(body.field) ||
    (body.field !== "delete-tag" && (!Array.isArray(body.registrationIds) ||
      body.registrationIds.length < 1 || body.registrationIds.length > 100 ||
      body.registrationIds.some((id: unknown) => typeof id !== "string" || !uuid.test(id)) ||
      new Set(body.registrationIds).size !== body.registrationIds.length)))
    return NextResponse.json({ error: "Selezione non valida." }, { status: 422 });
  const auth = await getCurrentAuthContext(await createSupabaseServerClient(), body.dashboard === "admin" ? "admin" : "manager");
  if (!auth) return NextResponse.json({ error: "Sessione scaduta. Accedi nuovamente." }, { status: 401 });
  const db = createSupabaseServiceClient();
  const { data, error } = body.field === "delete-tag"
    ? await db.rpc("delete_operational_tag", { p_event_id: body.eventId, p_tag_id: body.value, p_actor_user_id: auth.user.id })
    : await db.rpc("bulk_update_registration_operation", {
        p_event_id: body.eventId, p_registration_ids: body.registrationIds,
        p_actor_user_id: auth.user.id, p_field: body.field, p_value: body.value,
      });
  if (error) return NextResponse.json({ error: error.code === "42501"
    ? "Non hai i permessi per questa modifica."
    : "Operazione non eseguita. Aggiorna l’elenco e verifica che persone e opzioni siano ancora disponibili." }, { status: 422 });
  for (const path of ["/dashboard/admin", "/dashboard/manager", "/dashboard/capogruppo", "/dashboard/partecipante"])
    revalidatePath(path);
  return NextResponse.json({ ok: true, count: data });
}
