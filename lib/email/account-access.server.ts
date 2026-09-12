import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { renderAccountAccessEmail, type AccountAccessInput } from "./account-access.ts";
import { loadGroupEmailLocale, loadRegistrationEmailLocale } from "./group-locale.server.ts";
import { sendTransactionalEmail } from "./smtp";

/** Called only after authorized registration/role writes have all succeeded. */
export async function sendAccountAccessEmail(
  supabase: SupabaseClient,
  input: AccountAccessInput & {
    email: string;
    eventId: string | null;
    actorUserId: string;
    entityId: string;
    groupId?: string | null;
  },
): Promise<boolean> {
  const metadata = {
    email_hash: createHash("sha256").update(input.email.trim().toLowerCase()).digest("hex"),
    role: input.role ?? null,
    template: "account-access-v1",
    locale: null as string | null,
    country_iso2: null as string | null,
    group_id: null as string | null,
    locale_source: "group-country-v1",
  };
  let sent = false;
  try {
    if (!input.role && !input.eventId) throw new Error("Email registration requires an event");
    const language = input.role
      ? input.eventId
        ? await loadGroupEmailLocale(supabase, input.eventId, input.groupId ?? null)
        : { locale: "en" as const, countryIso2: null, groupId: null }
      : await loadRegistrationEmailLocale(supabase, input.eventId!, input.entityId);
    metadata.locale = language.locale;
    metadata.country_iso2 = language.countryIso2;
    metadata.group_id = language.groupId;
    await sendTransactionalEmail({ to: input.email, ...renderAccountAccessEmail({ ...input, locale: language.locale }) });
    sent = true;
  } catch {
    // SMTP errors can contain recipient addresses. Keep only operational metadata.
    console.warn("email.account_access_failed", { entityId: input.entityId });
  }
  try {
    const { error } = await supabase.from("audit_logs").insert({
      event_id: input.eventId,
      actor_user_id: input.actorUserId,
      action: `email.account_access_${sent ? (process.env.EMAIL_DELIVERY_MODE === "log" ? "simulated" : "sent") : "failed"}`,
      entity_table: input.role ? "profiles" : "registrations",
      entity_id: input.entityId,
      metadata,
    });
    if (error) throw error;
  } catch {
    // An audit failure after SMTP acceptance must not encourage another send.
    console.warn("email.account_access_audit_failed", { entityId: input.entityId, sent });
  }
  return sent;
}
