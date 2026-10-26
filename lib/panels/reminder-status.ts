import type { SupabaseClient } from "@supabase/supabase-js";

/** Committing the prepared feature must not install it or activate email delivery. */
export async function forumRemindersEnabled(db: SupabaseClient): Promise<boolean> {
  const { data, error } = await db.from("forum_reminder_settings").select("event_id")
    .eq("enabled", true).limit(1);
  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01") return false;
    throw Error("forum_reminder_settings_unavailable");
  }
  return Boolean(data?.length);
}
