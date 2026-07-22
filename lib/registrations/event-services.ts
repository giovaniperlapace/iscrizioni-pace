export type EventServiceOption = {
  id: string;
  eventId: string;
  label: string;
  description: string | null;
  isActive: boolean;
  publicOrder: number;
};

export type ParticipantEventService = {
  id: string;
  eventId: string;
  registrationId: string;
  participantId: string;
  serviceId: string;
  serviceLabel: string;
  status: ParticipantEventServiceStatus;
  source: ParticipantEventServiceSource;
  participantNote: string | null;
  operatorNote: string | null;
  updatedAt: string | null;
};

export type ParticipantEventServiceStatus =
  | "preference_pending"
  | "proposal_pending"
  | "assigned"
  | "declined";

export type ParticipantEventServiceSource =
  | "participant_preference"
  | "manager"
  | "capogruppo";

export const EVENT_SERVICE_LABEL_MAX_LENGTH = 40;
export const EVENT_SERVICE_DESCRIPTION_MAX_LENGTH = 160;

export function normalizeEventServiceLabel(
  value: FormDataEntryValue | null
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const label = value.replace(/\s+/g, " ").trim();

  return label.length > 0 ? label.slice(0, EVENT_SERVICE_LABEL_MAX_LENGTH) : null;
}

export function isEventServiceLabelWithinLimit(
  value: FormDataEntryValue | null
): boolean {
  if (typeof value !== "string") {
    return true;
  }

  return normalizeWhitespace(value).length <= EVENT_SERVICE_LABEL_MAX_LENGTH;
}

export function normalizeEventServiceDescription(
  value: FormDataEntryValue | null
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const description = value.replace(/\s+/g, " ").trim();

  return description.length > 0 ? description.slice(0, 240) : null;
}

export function isEventServiceDescriptionWithinLimit(
  value: FormDataEntryValue | null
): boolean {
  if (typeof value !== "string") {
    return true;
  }

  return normalizeWhitespace(value).length <= EVENT_SERVICE_DESCRIPTION_MAX_LENGTH;
}

export function normalizeEventServiceCatalogDescription(
  value: FormDataEntryValue | null
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const description = normalizeWhitespace(value);

  return description.length > 0
    ? description.slice(0, EVENT_SERVICE_DESCRIPTION_MAX_LENGTH)
    : null;
}

export function normalizeEventServiceOrder(
  value: FormDataEntryValue | null
): number {
  if (typeof value !== "string") {
    return 100;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, 9999)) : 100;
}

export function parseEventServiceFilter(value: string | undefined): string {
  const normalized = (value ?? "").trim();

  return normalized || "all";
}

export function parseParticipantEventServiceStatus(
  value: FormDataEntryValue | null
): ParticipantEventServiceStatus {
  return value === "proposal_pending" ||
    value === "preference_pending" ||
    value === "declined"
    ? value
    : "assigned";
}

export function eventServiceStatusLabel(
  status: string | null | undefined
): string {
  switch (status) {
    case "preference_pending":
      return "Preferenza da approvare";
    case "proposal_pending":
      return "Proposta inviata";
    case "assigned":
      return "Assegnato";
    case "declined":
      return "Rifiutato";
    default:
      return "Senza servizio";
  }
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
