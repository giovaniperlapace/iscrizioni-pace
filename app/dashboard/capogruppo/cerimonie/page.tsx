import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth/session";
import { getRequestLocale } from "@/lib/i18n/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { loadDistribution } from "@/lib/ceremonies/distribution.server";
import { DISTRIBUTION_COPY } from "@/lib/ceremonies/distribution-copy";
import { LeaderSectionNavigation } from "../section-navigation";
import { DashboardRoleTabs } from "@/app/dashboard/role-tabs";
import { CeremonyDistribution } from "@/app/dashboard/ceremony-distribution";
import {
  saveLeaderNominee,
  refreshLeaderDistribution,
} from "@/app/dashboard/ceremony-distribution-actions";
export default async function Page() {
  const db = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(db, "capogruppo");
  if (!auth || auth.dashboardRole !== "capogruppo") redirect("/dashboard");
  const locale = await getRequestLocale();
  let view;
  try {
    view = await loadDistribution(db, createSupabaseServiceClient, "leader");
  } catch {
    view = null;
  }
  return (
    <main className="app-page">
      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-8 sm:px-8">
        <DashboardRoleTabs
          activeRole="capogruppo"
          eventRoles={auth.eventRoles}
          hasReceptionAssignments={auth.hasReceptionAssignments}
        />
        <LeaderSectionNavigation active="ceremonies" locale={locale} />
        {view ? (
          <CeremonyDistribution
            initialView={view}
            locale={locale}
            canManage
            save={saveLeaderNominee}
            refresh={refreshLeaderDistribution}
          />
        ) : (
          <p role="alert">{DISTRIBUTION_COPY[locale].failure}</p>
        )}
      </div>
    </main>
  );
}
