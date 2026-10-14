import { processForumWaitlistNotifications } from "@/lib/panels/waitlist-delivery.server";
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
    const [campaigns, forums] = await Promise.allSettled([
      processDueCampaignDeliveries({ actorUserId: null }),
      processForumWaitlistNotifications(),
    ]);
    if (campaigns.status === "rejected" || forums.status === "rejected") {
      return NextResponse.json({ error: "Elaborazione delle code non riuscita." }, { status: 500 });
    }
    return NextResponse.json({ ...campaigns.value, forumWaitlist: forums.value });
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "Elaborazione coda non riuscita.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
