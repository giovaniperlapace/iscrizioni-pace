import { ProgramHome } from "./program-home";
import RegistrationHome from "./registration-home";
import { getPanelReleaseMode } from "@/lib/panels/release";
import type { Metadata } from "next";

import { getEventProgramCopy } from "@/lib/events/program-copy";
import { getRequestLocale } from "@/lib/i18n/server";
import { getPublicPanelProgram } from "@/lib/panels/public-program";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type HomeProps = {
  searchParams: Promise<{
    error?: string;
    email?: string;
    sent?: string;
  }>;
};

export async function generateMetadata(): Promise<Metadata> {
  if (await getPanelReleaseMode(await createSupabaseServerClient()) === "internal") return {};
  const locale = await getRequestLocale();
  const copy = getEventProgramCopy(locale);

  return {
    title: `${copy.title} | Assisi 2026`,
    description: copy.intro,
  };
}

export default async function Home({ searchParams }: HomeProps) {
  const [params, locale, supabase] = await Promise.all([
    searchParams,
    getRequestLocale(),
    createSupabaseServerClient(),
  ]);
  const releaseMode = await getPanelReleaseMode(supabase);
  if (releaseMode === "internal") return <RegistrationHome searchParams={Promise.resolve(params)} />;
  const panels = await getPublicPanelProgram(supabase);

  return <ProgramHome locale={locale} panels={panels} bookingsOpen={releaseMode === "open"} email={params.email} error={params.error} sent={params.sent} />;
}
