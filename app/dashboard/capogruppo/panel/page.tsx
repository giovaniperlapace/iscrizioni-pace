import { LeaderSectionNavigation } from "@/app/dashboard/capogruppo/section-navigation";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardRoleTabs } from "@/app/dashboard/role-tabs";
import { getCurrentAuthContext } from "@/lib/auth/session";
import { getCurrentOperationalEventId } from "@/lib/events/current";
import { getRequestLocale } from "@/lib/i18n/server";
import { GROUP_BOOKING_COPY } from "@/lib/panels/group-booking-copy";
import { isUuid, type GroupPanelView } from "@/lib/panels/group-bookings";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GroupPanelBookings } from "./panel-bookings";

export default async function GroupPanelPage({searchParams}: {searchParams: Promise<{section?: string}>}) {
  const db = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(db, "capogruppo");
  if (!auth || auth.dashboardRole !== "capogruppo") redirect("/login");
  const [locale, eventId, params] = await Promise.all([getRequestLocale(), getCurrentOperationalEventId(db), searchParams]);
  const copy = GROUP_BOOKING_COPY[locale];
  const section = isUuid(params.section) ? params.section : null;
  const result = eventId ? await db.rpc("get_group_panel_booking_view", {p_event_id: eventId, p_section_id: section}) : null;
  if (result?.error) console.error("[group-panel:load]", result.error.code, result.error.message);
  return <main className="app-page text-[var(--peace-ink)]">
    <section className="mx-auto grid w-full max-w-6xl gap-6 px-5 py-8 sm:px-8">
      <DashboardRoleTabs activeRole="capogruppo" eventRoles={auth.eventRoles} />
      <LeaderSectionNavigation active="panels" locale={locale} />
      <header><h1 className="text-xl font-semibold text-[var(--peace-blue-900)]">{copy.title}</h1><p className="mt-2 text-sm leading-6 text-[var(--peace-muted)]">{copy.intro}</p></header>
      {result?.data && !result.error ? <GroupPanelBookings key={section ?? "none"} view={result.data as GroupPanelView} sectionId={section} locale={locale} /> :
        <div role="alert" className="surface-panel p-5"><p>{copy.loadError}</p><Link href="/dashboard/capogruppo/panel" className="mt-3 inline-block underline">{copy.refresh}</Link></div>}
    </section>
  </main>;
}
