export type OperationalTagOption = {
  id: string;
  eventId: string;
  label: string;
  color: string;
};

export type ParticipantOperationalTag = OperationalTagOption & {
  assignedAt: string | null;
};

export function normalizeOperationalTagLabel(
  value: FormDataEntryValue | null
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const label = value.replace(/\s+/g, " ").trim();

  return label.length > 0 ? label.slice(0, 40) : null;
}

export function normalizeOperationalTagColor(
  value: FormDataEntryValue | null
): string {
  if (typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value.trim())) {
    return value.trim().toUpperCase();
  }

  return "#0F5F8F";
}

export function parseOperationalTagFilter(value: string | undefined): string {
  const normalized = (value ?? "").trim();

  return normalized || "all";
}

export function hasParticipantTag(
  participantTags: ParticipantOperationalTag[],
  tagFilter: string
): boolean {
  if (tagFilter === "all") {
    return true;
  }

  if (tagFilter === "none") {
    return participantTags.length === 0;
  }

  return participantTags.some((tag) => tag.id === tagFilter);
}
