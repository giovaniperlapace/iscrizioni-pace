import { NextResponse } from "next/server";

import { processDueCampaignDeliveries } from "@/lib/email/campaign-delivery.server";

export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Accesso non autorizzato." }, { status: 401 });
  }

  try {
    const result = await processDueCampaignDeliveries({
      actorUserId: null,
    });
    return NextResponse.json(result);
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "Elaborazione coda non riuscita.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
