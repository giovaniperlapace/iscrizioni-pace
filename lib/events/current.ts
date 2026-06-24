import type { SupabaseClient } from "@supabase/supabase-js";

export type CurrentEvent = {
  id: string;
  slug?: string | null;
  title: string;
  status?: string | null;
  city?: string | null;
  country?: string | null;
  starts_on?: string | null;
  ends_on?: string | null;
  registration_opens_at?: string | null;
  registration_closes_at?: string | null;
};

export async function getCurrentOperationalEvent(
  supabase: SupabaseClient,
  select = "id,title"
): Promise<CurrentEvent | null> {
  const { data } = await supabase
    .from("events")
    .select(select)
    .eq("is_current", true)
    .maybeSingle();

  return (data as CurrentEvent | null) ?? null;
}

export async function getCurrentOperationalEventId(
  supabase: SupabaseClient
): Promise<string | null> {
  return (await getCurrentOperationalEvent(supabase, "id"))?.id ?? null;
}
