import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { ceremonyContext } from "@/lib/ceremonies/service";
import { isMapId } from "@/lib/ceremonies/seat-map";
import { loadAllRows } from "@/lib/supabase/all-rows";
import { csvCell } from "@/lib/email/campaign-report";
import { postmarkRead } from "@/lib/email/postmark-reporting";
import { getEmailConfig } from "@/lib/email/config";
import {
  PUBLICATION_EMAIL_LABELS,
  publicationDeliveryEvidence,
  type PublicationReport,
  type PublicationRecipient,
} from "@/lib/ceremonies/publication-report";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export const maxDuration = 60;
async function access(request: Request) {
  const url = new URL(request.url),
    plan = url.searchParams.get("planId"),
    publication = url.searchParams.get("publication");
  if (!isMapId(plan) || (publication && !isMapId(publication)))
    throw Error("invalid");
  const context = await ceremonyContext(await createSupabaseServerClient());
  if (!context?.canManage) throw Error("forbidden");
  const db = createSupabaseServiceClient();
  const result = await db
    .from("ceremony_plans")
    .select("id")
    .eq("id", plan)
    .eq("event_id", context.event.id)
    .maybeSingle();
  if (result.error) throw Error("unavailable");
  if (!result.data) throw Error("forbidden");
  if (publication) {
    const found = await db
      .from("ceremony_assignment_drafts")
      .select("id")
      .eq("plan_id", plan)
      .eq("publication_id", publication)
      .eq("state", "published")
      .limit(1);
    if (found.error) throw Error("unavailable");
    if (!found.data?.length) throw Error("forbidden");
  }
  return { url, plan: plan!, publication, db, eventId: context.event.id };
}
function failure(error: unknown) {
  const forbidden = error instanceof Error && error.message === "forbidden",
    invalid = error instanceof Error && error.message === "invalid";
  return NextResponse.json(
    {
      error: forbidden
        ? "Non autorizzato."
        : invalid
          ? "Richiesta non valida."
          : "Report non disponibile. Riprova.",
    },
    { status: forbidden ? 403 : invalid ? 400 : 503, headers },
  );
}
export async function GET(request: Request) {
  try {
    const { url, plan, publication, db, eventId } = await access(request);
    const drafts = await loadAllRows((from, to) =>
      db
        .from("ceremony_assignment_drafts")
        .select("id,publication_id,data,updated_at")
        .eq("plan_id", plan)
        .eq("state", "published")
        .order("updated_at", { ascending: false })
        .order("id")
        .range(from, to),
    );
    if (drafts.error) throw Error("unavailable");
    const summaries = new Map<
      string,
      { id: string; date: string; seats: number; emails: number }
    >();
    for (const d of drafts.data) {
      const row = summaries.get(d.publication_id) ?? {
        id: d.publication_id,
        date: d.updated_at,
        seats: 0,
        emails: 0,
      };
      row.seats += Number(d.data.quantity);
      summaries.set(row.id, row);
    }
    const selected = publication ?? summaries.keys().next().value ?? null;
    const result = await loadAllRows((from, to) =>
      db
        .from("ceremony_publication_emails")
        .select(
          "id,publication_id,user_id,payload,recipient,state,error_code,created_at,accepted_at,delivery_state,delivery_at,delivery_checked_at,subject_snapshot,text_snapshot",
        )
        .eq("plan_id", plan)
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to),
    );
    if (result.error) throw Error("unavailable");
    const recipients: PublicationRecipient[] = [],
      counts: Record<string, number> = {};
    for (const r of result.data) {
      const summary = summaries.get(r.publication_id);
      if (summary) summary.emails++;
      if (r.publication_id !== selected) continue;
      const state = r.delivery_state ?? r.state;
      counts[state] = (counts[state] ?? 0) + 1;
      recipients.push({
        id: r.id,
        name: r.payload.lines.map((l: { name: string }) => l.name).join(", "),
        recipient: r.recipient,
        kind: r.user_id ? "leader" : "personal",
        state,
        reason: r.error_code,
        createdAt: r.created_at,
        acceptedAt: r.accepted_at,
        deliveryAt: r.delivery_at,
        checkedAt: r.delivery_checked_at,
        subject: r.subject_snapshot,
        text: r.text_snapshot,
      });
    }
    const report: PublicationReport = {
      publications: [...summaries.values()],
      selected,
      counts,
      recipients,
    };
    if (url.searchParams.get("format") === "csv")
      return new Response(
        "\ufeff" +
          [
            [
              "Destinatario / gruppo",
              "Tipo",
              "Email di invio salvata",
              "Esito",
              "Motivo",
              "Accettata il",
              "Esito consegna il",
              "Verificata il",
            ],
            ...recipients.map((r) => [
              r.name,
              r.kind === "leader" ? "Capogruppo" : "Nominale",
              r.recipient,
              PUBLICATION_EMAIL_LABELS[r.state] ?? r.state,
              r.reason,
              r.acceptedAt,
              r.deliveryAt,
              r.checkedAt,
            ]),
          ]
            .map((row) => row.map(csvCell).join(";"))
            .join("\r\n"),
        {
          headers: {
            ...headers,
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="cerimonia-${plan}-${selected ?? "nessuna"}.csv"`,
          },
        },
      );
    return NextResponse.json(report, { headers });
  } catch (error) {
    return failure(error);
  }
}
// Explicit refresh only. Read provider evidence; never resend a message.
export async function POST(request: Request) {
  try {
    const { plan, publication, db, eventId } = await access(request);
    if (!publication) throw Error("invalid");
    const config = getEmailConfig();
    if (config.deliveryMode === "log")
      return NextResponse.json(
        { checked: 0, unavailable: 0, disabled: true },
        { headers },
      );
    const result = await db
      .from("ceremony_publication_emails")
      .select("id,message_id,recipient")
      .eq("plan_id", plan)
      .eq("event_id", eventId)
      .eq("publication_id", publication)
      .eq("state", "accepted")
      .not("message_id", "is", null)
      .order("delivery_checked_at", { ascending: true, nullsFirst: true })
      .order("id")
      .limit(20);
    if (result.error) throw Error("unavailable");
    let checked = 0,
      unavailable = 0;
    for (let start = 0; start < result.data.length; start += 5) {
      await Promise.all(
        result.data.slice(start, start + 5).map(async (r) => {
          try {
            const raw = await postmarkRead(
              `/messages/outbound/${encodeURIComponent(r.message_id)}/details`,
            );
            const evidence = publicationDeliveryEvidence(
              raw,
              r.message_id,
              r.recipient,
              config.transactionalStream,
            );
            if (evidence) {
              // Concurrent refreshes must never overwrite newer delivery evidence.
              const saved = await db
                .from("ceremony_publication_emails")
                .update({
                  delivery_state: evidence.state,
                  delivery_at: evidence.at,
                })
                .eq("id", r.id)
                .eq("message_id", r.message_id)
                .eq("state", "accepted")
                .or(
                  `delivery_at.is.null,delivery_at.${evidence.state === "bounced" ? "lte" : "lt"}.${evidence.at}`,
                );
              if (saved.error) throw Error("unavailable");
            }
            const checkedResult = await db
              .from("ceremony_publication_emails")
              .update({ delivery_checked_at: new Date().toISOString() })
              .eq("id", r.id)
              .eq("message_id", r.message_id)
              .eq("state", "accepted");
            if (checkedResult.error) throw Error("unavailable");
            checked++;
          } catch {
            unavailable++;
          }
        }),
      );
    }
    return NextResponse.json(
      { checked, unavailable, disabled: false },
      { headers },
    );
  } catch (error) {
    return failure(error);
  }
}
