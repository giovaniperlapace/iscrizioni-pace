import { redirect } from "next/navigation";
import Link from "@/components/pending-link";
import { getRequestLocale } from "@/lib/i18n/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { loadPersonalSeats } from "@/lib/ceremonies/distribution.server";
import { DISTRIBUTION_COPY } from "@/lib/ceremonies/distribution-copy";
import { PersonalCeremonySeats } from "./seats";
export default async function Page() {
  const db = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) redirect("/login");
  const locale = await getRequestLocale(),
    c = DISTRIBUTION_COPY[locale];
  let seats;
  try {
    seats = await loadPersonalSeats(db, createSupabaseServiceClient);
  } catch {
    seats = null;
  }
  return (
    <main className="app-page">
      <div className="mx-auto grid max-w-4xl gap-5 px-4 py-8 sm:px-8">
        <Link href="/dashboard/partecipante" className="underline">
          {c.back}
        </Link>
        {seats ? (
          <PersonalCeremonySeats seats={seats} locale={locale} />
        ) : (
          <p role="alert">{c.failure}</p>
        )}
      </div>
    </main>
  );
}
