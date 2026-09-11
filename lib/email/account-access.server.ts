import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { renderAccountAccessEmail, type AccountAccessInput } from "./account-access.ts";
import { sendTransactionalEmail } from "./smtp";

/** Called only after authorized registration/role writes have all succeeded. */
export async function sendAccountAccessEmail(
  supabase: SupabaseClient,
  input: AccountAccessInput & {
    email: string;
    eventId: string | null;
    actorUserId: string;
    entityId: string;
  },
): Promise<boolean> {
  const metadata = {
    email_hash: createHash("sha256").update(input.email.trim().toLowerCase()).digest("hex"),
    role: input.role ?? null,
    template: "account-access-v1",
  };
  let sent = false;
  try {
    await sendTransactionalEmail({ to: input.email, ...renderAccountAccessEmail(input) });
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
