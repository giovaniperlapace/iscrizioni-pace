import type { SupabaseClient } from "@supabase/supabase-js";

export async function findAuthUserByEmail(db: SupabaseClient, email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const perPage = 500;
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const match = data.users.find(user => user.email?.toLowerCase() === normalizedEmail);
    if (match) return match;
    if (data.users.length < perPage) return null;
  }
}
