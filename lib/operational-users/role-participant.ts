import type { SupabaseClient } from "@supabase/supabase-js";
import { findAuthUserByEmail } from "./auth-user.server.ts";

// Caller has already authorized the role's event. Never accept identity fields
// from the form, nor rename an existing account to match a participant.
export async function resolveRoleParticipant(db: SupabaseClient, participantId: string, eventId: string) {
  const { data: registration, error: registrationError } = await db.from("registrations")
    .select("id,participants!inner(id,auth_user_id,first_name,last_name,participant_contacts(email,is_primary))")
    .eq("participant_id", participantId).eq("event_id", eventId).is("deleted_at", null).limit(1).maybeSingle();
  if (registrationError || !registration) return null;
  const person = Array.isArray(registration.participants) ? registration.participants[0] : registration.participants;
  if (!person) return null;
  let userId = person.auth_user_id as string | null;
  if (!userId) {
    const email = person.participant_contacts.find(contact => contact.is_primary)?.email?.trim().toLowerCase();
    if (!email) return null;
    let account = await findAuthUserByEmail(db, email);
    if (!account) {
      const fullName = [person.first_name, person.last_name].filter(Boolean).join(" ");
      const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: fullName } });
      account = data.user;
      if (error) account = await findAuthUserByEmail(db, email);
      if (!account) return null;
      const { error: profileError } = await db.from("profiles").upsert({ id: account.id, email, full_name: fullName }, { onConflict: "id", ignoreDuplicates: true });
      if (profileError) return null;
    }
    userId = account.id;
    const { error } = await db.from("participants").update({ auth_user_id: userId }).eq("id", participantId).is("auth_user_id", null);
    if (error) return null;
    // A concurrent assignment must not silently link a different account.
    const { data: linked, error: readError } = await db.from("participants").select("auth_user_id").eq("id", participantId).maybeSingle();
    if (readError || linked?.auth_user_id !== userId) return null;
  }
  const { data: profile, error } = await db.from("profiles").select("id,email,full_name").eq("id", userId).maybeSingle();
  return error || !profile?.email ? null : profile as { id: string; email: string; full_name: string | null };
}
