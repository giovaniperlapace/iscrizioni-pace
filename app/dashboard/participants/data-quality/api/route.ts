import { randomUUID, createHash } from "node:crypto";
import { hashIdentityFingerprint } from "@/lib/data-quality/fingerprint.server";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { qualityAccess } from "@/lib/data-quality/access.server";
import {
  filteredExportPeople,
  loadCatalog,
  loadQualityPeople,
} from "@/lib/data-quality/data.server";
import { readWorkbook, writeWorkbook } from "@/lib/data-quality/workbook";
import { MAX_FILE_BYTES, type ExcelRow } from "@/lib/data-quality/format";
import {
  buildPreviewRows,
  validateDecisions,
  type ImportPreview,
  type RowDecision,
} from "@/lib/data-quality/preview";
import {
  openQualityPayload,
  sealQualityPayload,
} from "@/lib/data-quality/seal.server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createOpaqueQrToken } from "@/lib/qrcode/token";
import { encryptQrToken } from "@/lib/qrcode/secure-token";
import { loadRowsForIds } from "@/lib/supabase/all-rows";
import { identityFingerprint } from "@/lib/data-quality/duplicates";

export const runtime = "nodejs";
export const maxDuration = 60;
const noStore = { "Cache-Control": "private, no-store" };
async function version(eventId: string, actor: string) {
  const { data, error } = await createSupabaseServiceClient().rpc(
    "quality_event_version",
    { p_event_id: eventId, p_actor_user_id: actor },
  );
  if (error || typeof data !== "string")
    throw new Error("Controllo qualità non disponibile. Riprova più tardi.");
  return data;
}
function rpcError(code: string) {
  if (code === "40001")
    return new Error(
      "I dati sono cambiati. Ricarica e genera una nuova anteprima.",
    );
  if (code === "42501")
    return new Error("Non hai i permessi per questa operazione.");
  return new Error(
    "Operazione annullata integralmente. Verifica i dati e le limitazioni del merge, poi aggiorna l’anteprima.",
  );
}
export async function GET(request: NextRequest) {
  try {
    const { db, auth, event, isAdmin } = await qualityAccess();
    const catalog = await loadCatalog(db, event.id);
    const kind = request.nextUrl.searchParams.get("kind");
    let rows: ExcelRow[] = [];
    let extras: { children: string[][]; attendance: string[][] } | undefined;
    if (kind === "export") {
      if (request.nextUrl.searchParams.get("view") === "deleted" && !isAdmin)
        throw new Error("Archivio riservato agli admin.");
      const { people, attendance } = await filteredExportPeople(
        db,
        {
          ...event,
          starts_on: event.starts_on ?? null,
          ends_on: event.ends_on ?? null,
        },
        request.nextUrl.searchParams,
      );
      const consents = (
        await loadRowsForIds(
          people.map((p) => p.id),
          (ids, from, to) =>
            db
              .from("participant_consents")
              .select(
                "registration_id,privacy_version,privacy_accepted_at,data_processing_accepted",
              )
              .in("registration_id", ids)
              .order("privacy_accepted_at", { ascending: false })
              .order("id")
              .range(from, to),
        )
      ).data;
      rows = people.map((person) => {
        const consent = consents.find(
          (item) =>
            item.registration_id === person.id && item.data_processing_accepted,
        );
        return {
          nome: person.firstName ?? "",
          cognome: person.lastName ?? "",
          data_nascita: person.birthDate ?? "",
          email: person.email ?? "",
          telefono: person.phone ?? "",
          paese: person.country ?? "",
          citta: person.city ?? "",
          gruppo: person.currentGroupId ?? "",
          servizio: person.currentServiceId ?? "",
          stato_servizio: person.currentServiceStatus ?? "",
          tag: person.tagIds.join(";"),
          stato: person.registrationStatus,
          consenso_privacy: consent ? "si" : "",
          versione_privacy: consent?.privacy_version ?? "",
          data_consenso: consent?.privacy_accepted_at?.slice(0, 10) ?? "",
        };
      });
      extras = {
        children: people.flatMap((person) =>
          person.children.map((child) => [
            person.id,
            person.name,
            child.firstName,
            child.lastName,
            child.birthDate,
          ]),
        ),
        attendance: attendance.map((choice) => [
          choice.registration_id,
          people.find((person) => person.id === choice.registration_id)!.name,
          choice.day ?? "",
          choice.day_part ?? "",
          choice.choice ?? "",
        ]),
      };
      const { error } = await createSupabaseServiceClient()
        .from("audit_logs")
        .insert({
          event_id: event.id,
          actor_user_id: auth.user.id,
          action: "participants.exported",
          entity_table: "registrations",
          entity_id: event.id,
          metadata: {
            format: "xlsx-v1",
            registration_count: people.length,
            child_count: extras.children.length,
            filter_keys: [...request.nextUrl.searchParams.keys()].filter(
              (key) => key !== "kind",
            ),
          },
        });
      if (error)
        throw new Error("Impossibile registrare l’esportazione. Riprova.");
    } else if (kind !== "template") throw new Error("Download non valido.");
    const buffer = await writeWorkbook(rows, catalog, extras);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        ...noStore,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${kind === "template" ? "modello-partecipanti" : "partecipanti"}.xlsx"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Download non disponibile.",
      },
      { status: 400, headers: noStore },
    );
  }
}
// Enforce an actual body budget before formData/json parsing, even if a caller
// omits or forges Content-Length.
async function boundedBody(request: NextRequest) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Richiesta vuota.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 3 * 1024 * 1024) {
      await reader.cancel();
      throw new Error("Richiesta troppo grande.");
    }
    chunks.push(value);
  }
  return new Response(Buffer.concat(chunks), {
    headers: { "Content-Type": request.headers.get("content-type") ?? "" },
  });
}
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return NextResponse.json(
      { error: "Origine non consentita." },
      { status: 403, headers: noStore },
    );
  try {
    const { db, auth, event } = await qualityAccess(true);
    const service = createSupabaseServiceClient();
    const body = await boundedBody(request);
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await body.formData();
      const file = form.get("file");
      if (
        !(file instanceof File) ||
        !/\.xlsx$/i.test(file.name) ||
        file.size > MAX_FILE_BYTES
      )
        throw new Error("Carica un file .xlsx di massimo 2 MiB.");
      const input = await readWorkbook(Buffer.from(await file.arrayBuffer()));
      const before = await version(event.id, auth.user.id);
      const [catalog, people] = await Promise.all([
        loadCatalog(db, event.id),
        loadQualityPeople(service, event.id),
      ]);
      const rows = buildPreviewRows(input, catalog, people);
      for (const row of rows)
        for (const candidate of row.candidates)
          candidate.fingerprint = hashIdentityFingerprint(
            candidate.fingerprint,
          );
      if (before !== (await version(event.id, auth.user.id)))
        throw new Error(
          "I dati sono cambiati durante la validazione. Ricarica il file.",
        );
      const preview: ImportPreview = {
        kind: "import-v1",
        id: randomUUID(),
        actor: auth.user.id,
        eventId: event.id,
        version: before,
        expires: Date.now() + 20 * 60_000,
        rows,
      };
      const token = sealQualityPayload(preview);
      if (token.length > 2_500_000)
        throw new Error(
          "Troppi candidati duplicati. Dividi il file in parti più piccole.",
        );
      return NextResponse.json({ rows, token }, { headers: noStore });
    }
    const data = await body.json();
    if (data.action === "commit") {
      if (data.confirm !== true)
        throw new Error(
          "Conferma esplicitamente l’importazione e i consensi raccolti.",
        );
      const preview = openQualityPayload<ImportPreview>(
        data.token,
        "import-v1",
        auth.user.id,
        event.id,
      );
      const decisions = validateDecisions(
        preview.rows,
        data.decisions as RowDecision[],
      );
      const payloadHash = createHash("sha256")
        .update(JSON.stringify({ preview, decisions: data.decisions }))
        .digest("hex");
      const rows = decisions
        .filter((item) => item.decision.action === "import")
        .map(({ row, decision }) => {
          const qr = createOpaqueQrToken();
          return {
            row: row.row,
            firstName: row.values.nome,
            lastName: row.values.cognome,
            birthDate: row.values.data_nascita,
            email: row.values.email,
            phone: row.values.telefono,
            country: row.values.paese,
            city: row.values.citta,
            status: row.values.stato,
            groupId: row.groupId,
            serviceId: row.serviceId,
            serviceStatus: row.values.stato_servizio,
            tagIds: row.tagIds,
            consent: row.values.consenso_privacy,
            privacyVersion: row.values.versione_privacy,
            consentDate: row.values.data_consenso,
            qrHash: qr.tokenHash,
            qrEncrypted: encryptQrToken(qr.token),
            distinctReason: decision.reason || null,
            fingerprint: hashIdentityFingerprint(
              identityFingerprint(row.identity),
            ),
            candidates: row.candidates.map((match) => ({
              id: match.right,
              level: match.level,
              fingerprint: match.fingerprint,
            })),
          };
        });
      const skipped = decisions
        .filter((item) => item.decision.action === "skip")
        .map(({ row, decision }) => ({
          row: row.row,
          reason: decision.reason,
          had_errors: row.errors.length > 0,
          had_duplicates: row.candidates.length > 0,
        }));
      const result = await service.rpc("commit_participant_import", {
        p_import_id: preview.id,
        p_event_id: event.id,
        p_actor_user_id: auth.user.id,
        p_version: preview.version,
        p_payload_hash: payloadHash,
        p_rows: rows,
        p_skipped: skipped,
      });
      if (result.error) throw rpcError(result.error.code);
      for (const path of [
        "/dashboard/admin",
        "/dashboard/manager",
        "/dashboard/capogruppo",
      ])
        revalidatePath(path);
      return NextResponse.json(result.data, { headers: noStore });
    }
    if (data.action === "review") {
      const preview = openQualityPayload<{
        kind: string;
        actor: string;
        eventId: string;
        expires: number;
        version: string;
        left: string;
        right: string;
        leftFingerprint: string;
        rightFingerprint: string;
      }>(data.token, "review-v1", auth.user.id, event.id);
      if (
        data.confirm !== true ||
        !["not_duplicate", "merged"].includes(data.decision) ||
        typeof data.reason !== "string" ||
        data.reason.trim().length < 3 ||
        data.reason.trim().length > 500
      )
        throw new Error("Scegli l’esito, indica la motivazione e conferma.");
      const { error } = await service.rpc("review_participant_duplicate", {
        p_event_id: event.id,
        p_actor_user_id: auth.user.id,
        p_left_id: preview.left,
        p_right_id: preview.right,
        p_decision: data.decision,
        p_keep_id: data.keepId || null,
        p_reason: data.reason.trim(),
        p_version: preview.version,
        p_left_fingerprint: preview.leftFingerprint,
        p_right_fingerprint: preview.rightFingerprint,
      });
      if (error) throw rpcError(error.code);
      for (const path of [
        "/dashboard/admin",
        "/dashboard/manager",
        "/dashboard/capogruppo",
        "/dashboard/partecipante",
        "/dashboard/participants/data-quality",
      ])
        revalidatePath(path);
      return NextResponse.json({ ok: true }, { headers: noStore });
    }
    throw new Error("Operazione non valida.");
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Operazione non riuscita.",
      },
      { status: 422, headers: noStore },
    );
  }
}
