import { processSchoolQrEmails } from "@/lib/panels/school-qr-delivery";
import { processDueCeremonyPublications } from "@/lib/ceremonies/publication-delivery.server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
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
    const [campaigns, forums, schools, ceremonies] = await Promise.allSettled([
      processDueCampaignDeliveries({ actorUserId: null }),
      processForumWaitlistNotifications(),
      processSchoolQrEmails(createSupabaseServiceClient(), process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || ""),
      processDueCeremonyPublications(),
    ]);
    if (campaigns.status === "rejected" || forums.status === "rejected" || schools.status === "rejected" || ceremonies.status === "rejected") {
      return NextResponse.json({ error: "Elaborazione delle code non riuscita." }, { status: 500 });
    }
    return NextResponse.json({ ...campaigns.value, forumWaitlist: forums.value, schoolQr: schools.value, ceremonies: ceremonies.value });
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "Elaborazione coda non riuscita.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
