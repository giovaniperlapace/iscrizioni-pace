export type PresenceVariant = "a" | "a2" | "b" | "b2";
export type PresenceConfig = {
  eventId: string;
  version: string;
  source: string;
  zones: { id: string; label: string }[];
  groups: { groupId: string; sourceName: string; zoneId: string; rollup: string | null; operatorTag: string | null }[];
  zoneRoots: { groupId: string; sourceName: string; zoneId: string }[];
  unmatchedSourceGroups: string[];
};
export type PresenceGroup = { id: string; name: string; parent_group_id: string | null; is_assignable: boolean };
export type PresenceSource = {
  event: { id: string; title: string; starts_on: string | null; ends_on: string | null };
  extractedAt: string;
  registrations: { id: string; participant_id: string }[];
  children: { id: string; registration_id: string }[];
  groups: PresenceGroup[];
  assignments: { registration_id: string; group_id: string }[];
  attendance: { registration_id: string; day: string | null; day_part: string | null; choice: string }[];
  services: { id: string; label: string }[];
  serviceAssignments: { registration_id: string; service_id: string; status: string }[];
  tags: { id: string; label: string }[];
  tagAssignments: { participant_id: string; tag_id: string }[];
};
export type PresenceLine = { key: string; label: string; values: number[]; kind: "detail" | "subtotal" | "total"; zoneId: string };
export type PresenceReport = {
  variant: PresenceVariant;
  title: string;
  headers: string[];
  lines: PresenceLine[];
  warnings: string[];
  mapping: { groupId: string; name: string; zone: string; rollup: string; tag: string; status: string }[];
  total: number[];
  extractedAt: string;
  eventTitle: string;
  configVersion: string | null;
};
