import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProgramHome } from "@/app/program-home";
import { getRequestLocale } from "@/lib/i18n/server";
import { getEventProgramCopy } from "@/lib/events/program-copy";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { isHomeApprovalTokenValid } from "@/lib/panels/home-preview-share";
import type { PublicPanelProgramItem } from "@/lib/panels/public-program";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Anteprima home", robots: { index: false, follow: false, nocache: true },
};

export default async function SharedHomePreview({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isHomeApprovalTokenValid(token, process.env.HOME_APPROVAL_LINK, new Date().getTime())) notFound();
  // Validate the single expiring link before reading any programme data.
  const { data, error } = await createSupabaseServiceClient().rpc("get_home_approval_preview");
  if (error) throw new Error("Anteprima temporaneamente non disponibile.");
  if (!data) notFound();
  const preview = data as { panels: PublicPanelProgramItem[]; incomplete: Array<{ id: string; title: string }> };
  const locale = await getRequestLocale();
  return <>
    <ProgramHome locale={locale} panels={preview.panels} bookingsOpen={false} preview />
    {preview.incomplete.length ? <section className="app-container pb-12"><div className="surface-card mx-auto max-w-5xl p-6"><h2 className="text-xl font-bold">{getEventProgramCopy(locale).incomplete}</h2><ul className="mt-4 list-inside list-disc space-y-2">{preview.incomplete.map(panel => <li key={panel.id}>{panel.title}</li>)}</ul></div></section> : null}
  </>;
}
