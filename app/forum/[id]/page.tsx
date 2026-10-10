import { normalizeEmail } from "@/lib/registrations/validation";
import { notFound, redirect } from "next/navigation";
import { forumBookingPath, withForumIntent } from "@/lib/panels/booking-intent";
import { resolvePublicForumIntent } from "@/lib/panels/booking-intent.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ForumEntry({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ email?: string }> }) {
  const { id } = await params;
  const db = await createSupabaseServerClient();
  const forum = await resolvePublicForumIntent(db, id);
  if (!forum) notFound();
  const { data: { user } } = await db.auth.getUser();
  if (user) redirect(forumBookingPath(forum));
  const email = normalizeEmail((await searchParams).email ?? null);
  const home = email ? `/?email=${encodeURIComponent(email)}` : "/";
  redirect(`${withForumIntent(home, forum)}#forum-access-form`);
}
