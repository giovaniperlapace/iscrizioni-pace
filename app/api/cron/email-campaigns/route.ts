import { forumRemindersEnabled } from "@/lib/panels/reminder-status";
import { processSchoolQrEmails } from "@/lib/panels/school-qr-delivery";
import { processDueCeremonyPublications } from "@/lib/ceremonies/publication-delivery.server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { processForumWaitlistNotifications } from "@/lib/panels/waitlist-delivery.server";
import { processDueForumReminders } from "@/lib/panels/reminder-delivery.server";
import { processForumReminderReports } from "@/lib/panels/reminder-report";
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
    const reminderReadiness = forumRemindersEnabled(createSupabaseServiceClient());
    const [campaigns, forums, schools, ceremonies, reminders, reminderReports] = await Promise.allSettled([
      processDueCampaignDeliveries({ actorUserId: null }),
      processForumWaitlistNotifications(),
      processSchoolQrEmails(createSupabaseServiceClient(), process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || ""),
      processDueCeremonyPublications(),
      reminderReadiness.then(async enabled => enabled ? processDueForumReminders() : { disabled: true }),
      reminderReadiness.then(async enabled => enabled ? processForumReminderReports(createSupabaseServiceClient()) : { disabled: true }),
    ]);
    if (campaigns.status === "rejected" || forums.status === "rejected" || schools.status === "rejected" || ceremonies.status === "rejected" || reminders.status === "rejected" || reminderReports.status === "rejected") {
      return NextResponse.json({ error: "Elaborazione delle code non riuscita." }, { status: 500 });
    }
    return NextResponse.json({ ...campaigns.value, forumWaitlist: forums.value, schoolQr: schools.value, ceremonies: ceremonies.value, forumReminders: reminders.value, forumReminderReports: reminderReports.value });
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "Elaborazione coda non riuscita.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
