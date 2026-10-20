import { getEmailConfig } from "./config.ts";
import { emailHash, normalizePostmarkEvent } from "./campaign-report.ts";
export async function postmarkRead(path: string) {
  const config = getEmailConfig();
  if (config.deliveryMode === "log") throw new Error("provider_disabled");
  const response = await fetch("https://api.postmarkapp.com" + path, {
    headers: {
      Accept: "application/json",
      "X-Postmark-Server-Token": config.serverToken,
    },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
    redirect: "error",
  });
  if (!response.ok) throw new Error("provider_unavailable");
  return response.json();
}
export async function readSuppressedAddresses(): Promise<
  Map<string, { reason: string; origin: string; at: string }>
> {
  if (getEmailConfig().deliveryMode === "log") return new Map();
  const data = await postmarkRead(
    "/message-streams/" +
      encodeURIComponent(getEmailConfig().broadcastStream) +
      "/suppressions/dump",
  );
  if (!Array.isArray(data.Suppressions))
    throw new Error("invalid_suppression_response");
  return new Map(
    data.Suppressions.map(
      (s: {
        EmailAddress: string;
        SuppressionReason: string;
        Origin: string;
        CreatedAt: string;
      }) => [
        emailHash(s.EmailAddress),
        { reason: s.SuppressionReason, origin: s.Origin, at: s.CreatedAt },
      ],
    ),
  );
}
export async function suppressionWarnings(
  recipients: {
    selected: boolean;
    destinationEmail: string;
    fullName: string;
  }[],
) {
  try {
    const suppressed = await readSuppressedAddresses();
    return {
      checked: true,
      recipients: recipients
        .filter(
          (r) => r.selected && suppressed.has(emailHash(r.destinationEmail)),
        )
        .map((r) => ({ name: r.fullName, email: r.destinationEmail })),
    };
  } catch {
    return { checked: false, recipients: [] };
  }
}
// Provider details contain message bodies: return only normalized delivery evidence.
export function eventsFromDetails(d: Record<string, unknown>) {
  const config = getEmailConfig();
  const events = Array.isArray(d.MessageEvents) ? d.MessageEvents : [];
  return events.flatMap(
    (e: {
      Type: string;
      Recipient: string;
      ReceivedAt: string;
      Details?: {
        Summary?: string;
        BounceID?: string;
        DeliveryMessage?: string;
      };
    }) => {
      if (!["Delivered", "Bounced"].includes(e.Type)) return [];
      const kind = e.Type === "Delivered" ? "Delivery" : "Bounce";
      // QUEUE.Expired is a final timeout, eligible only after a fresh suppression
      // check. Other summaries remain non-retryable without typed provider evidence.
      return [
        normalizePostmarkEvent(
          {
            RecordType: kind,
            MessageStream: d.MessageStream,
            MessageID: d.MessageID,
            Recipient: e.Recipient,
            DeliveredAt: e.ReceivedAt,
            ...(/^smtp;550 4\.4\.7 QUEUE\.Expired; message expired$/.test(
              e.Details?.Summary ?? "",
            )
              ? { Type: "Transient", Inactive: false }
              : {}),
            Details: e.Details?.Summary ?? e.Details?.DeliveryMessage ?? "",
            Metadata: d.Metadata,
          },
          config.broadcastStream,
        ),
      ];
    },
  );
}
