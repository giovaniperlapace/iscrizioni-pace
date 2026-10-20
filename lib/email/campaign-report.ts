// Pure presentation and validation shared by reports, webhook ingestion and tests.
import { createHash } from "node:crypto";
export const emailHash = (email: string) =>
  createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
export const messageHash = (id: string) =>
  createHash("sha256").update(id).digest("hex");
export type DeliveryEvent = {
  message_hash: string;
  kind: string;
  occurred_at: string;
  detail: string;
  retryable: boolean;
};
export function normalizePostmarkEvent(
  input: Record<string, unknown>,
  stream: string,
) {
  if (input.MessageStream !== stream) throw new Error("wrong_stream");
  const kind = String(input.RecordType ?? "");
  if (
    !["Delivery", "Bounce", "SpamComplaint", "SubscriptionChange"].includes(
      kind,
    )
  )
    throw new Error("unsupported_event");
  const email = String(input.Recipient ?? input.Email ?? "")
    .trim()
    .toLowerCase();
  if (!/^[^\s,;<>@]+@[^\s,;<>@]+$/.test(email) || email.length > 320)
    throw new Error("invalid_recipient");
  const timestamp = input.DeliveredAt ?? input.BouncedAt ?? input.ChangedAt;
  if (typeof timestamp !== "string" || !Number.isFinite(Date.parse(timestamp)))
    throw new Error("invalid_date");
  const occurred_at = new Date(timestamp).toISOString();
  const messageId = typeof input.MessageID === "string" ? input.MessageID : "";
  if (kind !== "SubscriptionChange" && !/^[\da-f-]{36}$/i.test(messageId))
    throw new Error("invalid_message");
  if (
    kind === "SubscriptionChange" &&
    typeof input.SuppressSending !== "boolean"
  )
    throw new Error("invalid_suppression");
  const detail = String(
    input.Description ?? input.Details ?? input.SuppressionReason ?? "",
  ).slice(0, 1500);
  const bounceType = String(input.Type ?? "");
  const retryable =
    kind === "Bounce" &&
    ["SoftBounce", "Transient"].includes(bounceType) &&
    input.Inactive === false;
  const metadata =
    input.Metadata && typeof input.Metadata === "object"
      ? (input.Metadata as Record<string, unknown>)
      : {};
  const recipientId =
    typeof metadata.campaign_recipient_id === "string" &&
    /^[\da-f-]{36}$/i.test(metadata.campaign_recipient_id)
      ? metadata.campaign_recipient_id
      : null;
  return {
    event_key: messageHash(
      JSON.stringify([
        kind,
        messageId,
        email,
        occurred_at,
        input.SuppressSending ?? "",
      ]),
    ),
    message_hash: messageId ? messageHash(messageId) : null,
    email_hash: emailHash(email),
    kind,
    occurred_at,
    detail,
    retryable,
    recipient_id: recipientId,
    suppressed:
      kind === "SubscriptionChange" ? (input.SuppressSending as boolean) : null,
    reason: String(input.SuppressionReason ?? "").slice(0, 100),
    origin: String(input.Origin ?? "").slice(0, 50),
  };
}
export function reportOutcome(
  row: { status: string; error_code?: string | null },
  events: DeliveryEvent[],
) {
  if (row.status === "skipped")
    return {
      code: "excluded",
      label: "Escluso dalla selezione",
      reason:
        row.error_code === "registration_deleted"
          ? "Iscrizione non più attiva"
          : "",
    };
  const complaint = events.find((e) => e.kind === "SpamComplaint");
  const bounced = events.find((e) => e.kind === "Bounce");
  const delivered = events.find((e) => e.kind === "Delivery");
  if (complaint)
    return {
      code: "blocked",
      label: "Segnalata come spam",
      reason: complaint.detail,
    };
  if (bounced)
    return { code: "bounced", label: "Non recapitata", reason: bounced.detail };
  if (delivered)
    return { code: "delivered", label: "Consegnata al server", reason: "" };
  if (["postmark_406", "recipient_suppressed"].includes(row.error_code ?? ""))
    return {
      code: "blocked",
      label: "Indirizzo bloccato / disiscritto",
      reason: "Il servizio non accetta invii a questo indirizzo.",
    };
  if (row.status === "failed")
    return {
      code: "failed",
      label: "Invio fallito",
      reason:
        row.error_code === "retry_address_changed"
          ? "Indirizzo cambiato: creare una nuova campagna."
          : row.error_code === "invalid_recipient"
            ? "Indirizzo non valido"
            : row.error_code === "postmark_message_too_large"
              ? "Messaggio o allegati troppo grandi"
              : "Preparazione o invio non riuscito. " + (row.error_code ?? ""),
    };
  if (row.status === "sent")
    return {
      code: "accepted",
      label: "Accettata, consegna non confermata",
      reason: "",
    };
  if (row.status === "unknown" || row.status === "sending")
    return {
      code: "unknown",
      label: "Esito da verificare",
      reason: "Non reinviare prima della verifica.",
    };
  return { code: "queued", label: "In attesa", reason: "" };
}
export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s]*[=+@\-\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
