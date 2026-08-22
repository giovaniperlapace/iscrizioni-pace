import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth/session";
import { validateCampaignTemplate } from "@/lib/email/campaign-templates";
import { getCurrentOperationalEvent } from "@/lib/events/current";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(supabase, "manager");
  if (!auth || !auth.eventRoles.some((role) => role.role === "admin" || role.role === "manager")) return NextResponse.json({ error: "Non autorizzato." }, { status: 403 });
  const service = createSupabaseServiceClient();
  const event = await getCurrentOperationalEvent(service, "id");
  if (!event) return NextResponse.json({ error: "Nessun evento corrente." }, { status: 400 });
  const body = await request.json() as Record<string, unknown>;
  const id = text(body.id, 80) || null;
  const name = text(body.name, 80); const subject = text(body.subject, 180); const message = text(body.message, 20000);
  if (!name || !subject || !message) return NextResponse.json({ error: "Nome, oggetto e messaggio sono obbligatori." }, { status: 400 });
  const invalid = validateCampaignTemplate(subject, message);
  if (invalid.length) return NextResponse.json({ error: `Variabili non supportate: ${invalid.join(", ")}.` }, { status: 400 });
  if (id) {
    const { data: existing } = await service.from("email_templates").select("current_version").eq("id", id).eq("event_id", event.id).single();
    const version = (existing?.current_version ?? 0) + 1;
    const { error } = await service.from("email_templates").update({ name, subject, body_text: message, current_version: version, updated_by: auth.user.id }).eq("id", id).eq("event_id", event.id);
    if (error) return templateStorageError("update", error);
    await service.from("email_template_versions").insert({ template_id: id, version, subject, body_text: message, created_by: auth.user.id });
    return NextResponse.json({ ok: true, id, version });
  }
  const { data: template, error } = await service.from("email_templates").insert({ event_id: event.id, name, subject, body_text: message, created_by: auth.user.id, updated_by: auth.user.id }).select("id,current_version").single();
  if (error || !template) return templateStorageError("create", error);
  await service.from("email_template_versions").insert({ template_id: template.id, version: template.current_version, subject, body_text: message, created_by: auth.user.id });
  return NextResponse.json({ ok: true, id: template.id, version: template.current_version });
}

function text(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }

function templateStorageError(operation: "create" | "update", cause: unknown) {
  console.error(`[email-templates:${operation}]`, cause);
  return NextResponse.json(
    {
      error:
        "Non è stato possibile salvare il modello. Riprova tra qualche minuto.",
    },
    { status: 500 }
  );
}
