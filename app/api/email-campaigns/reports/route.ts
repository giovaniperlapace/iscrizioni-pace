import { NextResponse } from "next/server";
import {
  reportAccess,
  campaignReport,
  retryCampaign,
} from "@/lib/email/campaign-report.server";
import { csvCell } from "@/lib/email/campaign-report";
import { loadAllRows } from "@/lib/supabase/all-rows";
import { isPanelCampaign } from "@/lib/panels/management-access";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    const ctx = await reportAccess();
    const url = new URL(request.url);
    const id = url.searchParams.get("campaign");
    if (!id) {
      const { data } = await loadAllRows((from, to) =>
        ctx.service
          .from("email_campaigns")
          .select(
            "id,name,status,recipient_count,sent_at,filters_snapshot,subject_template,body_template,retry_of_campaign_id",
          )
          .eq("event_id", ctx.event.id)
          .not("sent_at", "is", null)
          .order("sent_at", { ascending: false })
          .order("id")
          .range(from, to),
      );
      const visible = data.filter(
        (c) =>
          ctx.panels ||
          !isPanelCampaign({
            ...c.filters_snapshot,
            subject_template: c.subject_template,
            body_template: c.body_template,
          }),
      );
      const page = Math.max(
        1,
        Math.min(
          Math.ceil(visible.length / 20) || 1,
          Number(url.searchParams.get("page")) || 1,
        ),
      );
      return NextResponse.json(
        {
          total: visible.length,
          page,
          campaigns: visible
            .slice((page - 1) * 20, page * 20)
            .map((c) => ({
              id: c.id,
              name: c.name,
              status: c.status,
              recipientCount: c.recipient_count,
              date: c.sent_at,
              parent: c.retry_of_campaign_id,
            })),
        },
        { headers },
      );
    }
    if (!/^[\da-f-]{36}$/i.test(id)) throw new Error("Campagna non valida.");
    const report = await campaignReport(ctx, id);
    if (url.searchParams.get("format") === "csv") {
      const fields = [
        "Nome",
        "Email",
        "Indirizzo storico verificato",
        "Esito",
        "Motivo",
        "Accettata il",
        "Consegnata il",
        "Campagna di reinvio",
      ];
      const csv =
        "\ufeff" +
        [
          fields.map(csvCell).join(";"),
          ...report.recipients.map((r) =>
            [
              r.name,
              r.email,
              r.snapshot ? "Sì" : "No: contatto attuale",
              r.label,
              r.reason,
              r.sentAt,
              r.deliveredAt,
              r.retryCampaignId,
            ]
              .map(csvCell)
              .join(";"),
          ),
        ].join("\r\n");
      return new Response(csv, {
        headers: {
          ...headers,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="campagna-${id}.csv"`,
        },
      });
    }
    return NextResponse.json(report, { headers });
  } catch {
    return NextResponse.json(
      { error: "Report non disponibile o accesso non consentito. Riprova." },
      { status: 403, headers },
    );
  }
}
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json(
      { error: "Origine non valida." },
      { status: 403, headers },
    );
  try {
    const ctx = await reportAccess();
    const body = await request.json();
    if (
      typeof body.campaignId !== "string" ||
      !Array.isArray(body.recipientIds) ||
      body.recipientIds.some(
        (id: unknown) => typeof id !== "string" || !/^[\da-f-]{36}$/i.test(id),
      ) ||
      body.confirm !== true
    )
      throw new Error("Conferma o selezione non valida.");
    const campaignId = await retryCampaign(
      ctx,
      body.campaignId,
      body.recipientIds,
    );
    return NextResponse.json({ campaignId }, { headers });
  } catch (cause) {
    const publicMessages = new Set([
      "Accesso non autorizzato.", "Accesso non consentito.", "Accesso forum non consentito.",
      "Campagna non disponibile.", "Report non disponibile.", "Selezione non valida.",
      "Conferma o selezione non valida.", "Reinvio già avviato: aggiorna il report.",
      "La selezione contiene esiti non reinviabili. Aggiorna il report.",
      "Un indirizzo è bloccato o disiscritto: non è stato avviato alcun reinvio.",
      "Un indirizzo è cambiato: prepara una nuova campagna.",
      "Reinvio non avviato: aggiorna il report e controlla la selezione.",
    ]);
    return NextResponse.json(
      {
        error:
          cause instanceof Error &&
          publicMessages.has(cause.message)
            ? cause.message
            : "Verifica del servizio non disponibile. Nessun nuovo reinvio confermato: aggiorna il report.",
      },
      { status: 400, headers },
    );
  }
}
