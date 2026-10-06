import { redirect } from "next/navigation";
import Link from "@/components/pending-link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { distributionContext } from "@/lib/ceremonies/distribution.server";
import { loadSeatMap } from "@/lib/ceremonies/seat-map.server";
import { getRequestLocale } from "@/lib/i18n/server";
import { SEAT_MAP_COPY } from "@/lib/ceremonies/seat-map-copy";
import { CeremonyMapWorkspace } from "@/app/dashboard/ceremony-map-workspace";
import {
  refreshLeaderMap,
  saveLeaderMap,
} from "@/app/dashboard/ceremony-map-actions";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const db = await createSupabaseServerClient(),
    context = await distributionContext(db, "leader");
  if (!context) redirect("/dashboard");
  const locale = await getRequestLocale(),
    c = SEAT_MAP_COPY[locale],
    plan = (await searchParams).plan;
  if (!plan) redirect("/dashboard/capogruppo/cerimonie");
  let view;
  try {
    view = await loadSeatMap(db, createSupabaseServiceClient, "leader", plan);
  } catch {
    view = null;
  }
  return (
    <main className="app-page">
      <div className="mx-auto grid max-w-6xl min-w-0 gap-5 px-4 py-8 sm:px-8">
        <Link href="/dashboard/capogruppo/cerimonie" className="underline">
          {c.back}
        </Link>
        {view ? (
          <CeremonyMapWorkspace
            key={view.planId}
            initialView={view}
            locale={locale}
            canManage
            save={saveLeaderMap}
            refresh={refreshLeaderMap}
          />
        ) : (
          <p role="alert">{c.failure}</p>
        )}
      </div>
    </main>
  );
}
