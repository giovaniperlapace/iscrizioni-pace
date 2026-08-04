export const PARTICIPANT_MESSAGE_MAX_LENGTH = 4_000;

export type ParticipantMessageError =
  | "empty"
  | "too-long"
  | "rate-limit"
  | "not-authenticated"
  | "not-found"
  | "delivery";

export function parseParticipantMessage(
  value: FormDataEntryValue | null
): { ok: true; value: string } | { ok: false; error: ParticipantMessageError } {
  if (typeof value !== "string") {
    return { ok: false, error: "empty" };
  }

  const normalized = value.replaceAll("\r\n", "\n").replaceAll("\0", "").trim();

  if (!normalized) {
    return { ok: false, error: "empty" };
  }

  if (normalized.length > PARTICIPANT_MESSAGE_MAX_LENGTH) {
    return { ok: false, error: "too-long" };
  }

  return { ok: true, value: normalized };
}
