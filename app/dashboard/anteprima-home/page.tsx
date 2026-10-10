import type { Metadata } from "next";
import { requirePanelManager } from "@/lib/panels/release.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPanelDraftCatalog } from "@/lib/panels/panel-drafts";
import { getEventLocations } from "@/lib/panels/event-locations";
import { buildHomePreview } from "@/lib/panels/home-preview";
import { getRequestLocale } from "@/lib/i18n/server";
import { getEventProgramCopy } from "@/lib/events/program-copy";
import { ProgramHome } from "@/app/program-home";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Anteprima home", robots: { index: false, follow: false } };

export default async function HomePreview() {
  // Authorize role AND current-event scope before any programme reads.
  await requirePanelManager();
  const db = await createSupabaseServerClient();
  const { data: event, error } = await db.from("events").select("id").eq("is_current", true).maybeSingle();
  if (error) throw error;
  const locale = await getRequestLocale();
  const [catalog, locations] = event ? await Promise.all([
    getPanelDraftCatalog(db, event.id), getEventLocations(db, event.id),
  ]) : [{ panels: [] }, []];
  const preview = buildHomePreview(catalog.panels, locations);
  return <>
    <ProgramHome locale={locale} panels={preview.panels} bookingsOpen={false} preview />
    {preview.incomplete.length ? <section className="app-container pb-12"><div className="surface-card mx-auto max-w-5xl p-6"><h2 className="text-xl font-bold">{getEventProgramCopy(locale).incomplete}</h2><ul className="mt-4 list-inside list-disc space-y-2">{preview.incomplete.map(panel => <li key={panel.id}>{panel.title}</li>)}</ul></div></section> : null}
  </>;
}
