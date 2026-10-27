import Link from "next/link";
import { CurtainIcon } from "@/components/curtain-icon";
import { getPanelReleaseMode } from "@/lib/panels/release";
import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth/session";
import { getRequestLocale } from "@/lib/i18n/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { loadLeaderTickets } from "@/lib/ceremonies/leader-tickets.server";
import { DISTRIBUTION_COPY } from "@/lib/ceremonies/distribution-copy";
import { LeaderSectionNavigation } from "../section-navigation";
import { DashboardRoleTabs } from "@/app/dashboard/role-tabs";
import { CeremonyLeaderSectors } from "@/app/dashboard/ceremony-leader-sectors";
import {
  saveLeaderPair,
  saveLeaderSectorBatch,
  refreshLeaderTickets,
} from "@/app/dashboard/ceremony-leader-tickets-actions";
export default async function Page({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const db = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(db, "capogruppo");
  if (!auth || auth.dashboardRole !== "capogruppo") redirect("/dashboard");
  const [locale, params, panelMode] = await Promise.all([getRequestLocale(), searchParams, getPanelReleaseMode(db)]);
  const kind = params.kind === "opening" ? "opening" : "closing";
  let view;
  try {
    view = await loadLeaderTickets(db, createSupabaseServiceClient);
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
        <LeaderSectionNavigation active="ceremonies" locale={locale} showPanels={panelMode === "open"} />
        <nav aria-label={DISTRIBUTION_COPY[locale].title} className="flex flex-wrap gap-2">
          {(["opening", "closing"] as const).map((item) => (
            <Link key={item} href={`/dashboard/capogruppo/cerimonie?kind=${item}`} prefetch={false} aria-current={kind === item ? "page" : undefined} className={`${kind === item ? "btn-primary" : "btn-secondary"} min-h-11 gap-2 px-4 py-2`}>
              <CurtainIcon size={18} aria-hidden="true" />{DISTRIBUTION_COPY[locale][item]}
            </Link>
          ))}
        </nav>
        {view ? (
          <CeremonyLeaderSectors
            key={kind}
            kind={kind}
            initialView={view}
            locale={locale}
            save={saveLeaderPair}
            saveMany={saveLeaderSectorBatch}
            refresh={refreshLeaderTickets}
          />
        ) : (
          <p role="alert">{DISTRIBUTION_COPY[locale].failure}</p>
        )}
      </div>
    </main>
  );
}
