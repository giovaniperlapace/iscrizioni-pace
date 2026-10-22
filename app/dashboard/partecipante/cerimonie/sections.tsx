import type { SupportedLocale } from "@/lib/i18n/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { loadPersonalSeats } from "@/lib/ceremonies/distribution.server";
import { PersonalCeremonySeats } from "./seats";

export async function ParticipantCeremonySections({ locale }: { locale: SupportedLocale }) {
  let seats;
  try {
    seats = await loadPersonalSeats(await createSupabaseServerClient(), createSupabaseServiceClient);
  } catch {
    seats = null;
  }
  return <PersonalCeremonySeats seats={seats} locale={locale} />;
}
