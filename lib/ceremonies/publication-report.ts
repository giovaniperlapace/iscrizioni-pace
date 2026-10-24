export const PUBLICATION_EMAIL_LABELS: Record<string, string> = {
  queued: "In coda",
  sending: "In elaborazione",
  accepted: "Accettata, consegna non confermata",
  delivered: "Consegnata al server",
  bounced: "Non recapitata",
  failed: "Invio fallito",
  uncertain: "Esito incerto",
  skipped: "Non inviata",
};
export type PublicationSummary = {
  id: string;
  date: string;
  seats: number;
  emails: number;
};
export type PublicationRecipient = {
  id: string;
  name: string;
  recipient: string | null;
  kind: "personal" | "leader";
  state: string;
  reason: string | null;
  createdAt: string;
  acceptedAt: string | null;
  deliveryAt: string | null;
  checkedAt: string | null;
  subject: string | null;
  text: string | null;
};
export type PublicationReport = {
  publications: PublicationSummary[];
  selected: string | null;
  counts: Record<string, number>;
  recipients: PublicationRecipient[];
};
// Accept evidence only for the exact message, stream and saved delivery address.
export function publicationDeliveryEvidence(
  details: unknown,
  messageId: string,
  recipient: string,
  stream: string,
): { state: "delivered" | "bounced"; at: string } | null {
  if (!details || typeof details !== "object") throw Error("invalid_evidence");
  const d = details as Record<string, unknown>;
  if (
    d.MessageID !== messageId ||
    d.MessageStream !== stream ||
    d.Sandboxed === true ||
    !Array.isArray(d.MessageEvents)
  )
    throw Error("invalid_evidence");
  const events = d.MessageEvents.filter(
    (
      e,
    ): e is {
      Type: "Delivered" | "Bounced";
      ReceivedAt: string;
      Recipient: string;
    } =>
      !!e &&
      typeof e === "object" &&
      ["Delivered", "Bounced"].includes(e.Type) &&
      typeof e.Recipient === "string" &&
      e.Recipient.trim().toLowerCase() === recipient.trim().toLowerCase() &&
      typeof e.ReceivedAt === "string" &&
      Number.isFinite(Date.parse(e.ReceivedAt)),
  );
  events.sort(
    (a, b) =>
      Date.parse(b.ReceivedAt) - Date.parse(a.ReceivedAt) ||
      (a.Type === "Bounced" ? -1 : 1),
  );
  return events[0]
    ? {
        state: events[0].Type === "Delivered" ? "delivered" : "bounced",
        at: new Date(events[0].ReceivedAt).toISOString(),
      }
    : null;
}
