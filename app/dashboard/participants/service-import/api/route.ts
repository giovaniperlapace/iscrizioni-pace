import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { qualityAccess } from "@/lib/data-quality/access.server";
import { MAX_FILE_BYTES } from "@/lib/data-quality/format";
import { loadAllRows } from "@/lib/supabase/all-rows";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { readServiceWorkbook, writeServiceReport, writeServiceTemplate } from "@/lib/service-import/workbook";
import type { ServiceImportResult } from "@/lib/service-import/format";

export const runtime = "nodejs";
export const maxDuration = 60;
const noStore = { "Cache-Control": "private, no-store" };

export async function GET() {
  try {
    const { db, event } = await qualityAccess(true);
    const catalog = await loadAllRows((from, to) => db.from("event_services")
      .select("id,label").eq("event_id", event.id).eq("is_active", true).order("id").range(from, to));
    const buffer = await writeServiceTemplate(catalog.data);
    return new NextResponse(new Uint8Array(buffer), { headers: {
      ...noStore,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modello-servizi.xlsx"',
    } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Modello non disponibile." }, { status: 400, headers: noStore });
  }
}

async function boundedForm(request: NextRequest) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Richiesta vuota.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_FILE_BYTES + 64 * 1024) {
      await reader.cancel();
      throw new Error("Carica un file .xlsx di massimo 2 MiB.");
    }
    chunks.push(value);
  }
  return new Response(Buffer.concat(chunks), { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData();
}

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Origine non consentita." }, { status: 403, headers: noStore });
  }
  try {
    const { auth, event } = await qualityAccess(true);
    const form = await boundedForm(request);
    const file = form.get("file");
    const importId = form.get("importId");
    if (typeof importId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(importId)) {
      throw new Error("Richiesta non valida. Seleziona nuovamente il file.");
    }
    if (!(file instanceof File) || !/\.xlsx$/i.test(file.name) || file.size > MAX_FILE_BYTES) {
      throw new Error("Carica un file .xlsx di massimo 2 MiB.");
    }
    const rows = await readServiceWorkbook(Buffer.from(await file.arrayBuffer()));
    const { data, error } = await createSupabaseServiceClient().rpc("import_participant_services", {
      p_import_id: importId, p_event_id: event.id, p_actor_user_id: auth.user.id, p_rows: rows,
    });
    if (error) {
      if (error.code === "42501") throw new Error("Non hai i permessi per questa operazione o l’evento corrente è cambiato.");
      if (error.code === "PT409") throw new Error("Il file della richiesta è cambiato. Selezionalo nuovamente.");
      throw new Error("Importazione non completata. Riprova con lo stesso file: il reinvio recupera anche un risultato già registrato.");
    }
    const result = data as ServiceImportResult;
    for (const path of ["/dashboard/admin", "/dashboard/manager", "/dashboard/capogruppo", "/dashboard/partecipante"]) revalidatePath(path);
    // Keep the committed report usable even if generating the Excel file fails.
    let reportBase64: string | null = null;
    try { reportBase64 = (await writeServiceReport(result.rows)).toString("base64"); } catch { /* The on-screen report remains available. */ }
    return NextResponse.json({ ...result, reportBase64 }, { headers: noStore });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Importazione non riuscita. Riprova con lo stesso file." }, { status: 422, headers: noStore });
  }
}
