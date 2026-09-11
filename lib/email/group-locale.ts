import type { SupportedLocale } from "../i18n/config.ts";

const COUNTRY_LOCALES: Record<string, SupportedLocale> = {
  IT: "it", FR: "fr", DE: "de", ES: "es", NL: "nl", UA: "uk",
};

export function emailLocaleForCountry(iso2: string | null | undefined): SupportedLocale {
  return COUNTRY_LOCALES[iso2?.trim().toUpperCase() ?? ""] ?? "en";
}

export type EmailLocaleGroup = {
  id: string;
  event_id: string;
  parent_group_id: string | null;
  country_id: string | null;
  node_type: string;
  is_active: boolean;
};

/** A country ancestor defines the language for its whole subtree. */
export function groupCountryId(groups: EmailLocaleGroup[], eventId: string, groupId: string): string | null {
  const byId = new Map(groups.map(group => [group.id, group]));
  const visited = new Set<string>();
  let current: string | null = groupId;
  let nearestCountry: string | null = null;
  let countryAncestor: string | null = null;
  while (current) {
    if (visited.has(current)) throw new Error("Cyclic email group hierarchy");
    visited.add(current);
    const group = byId.get(current);
    if (!group || group.event_id !== eventId || !group.is_active) throw new Error("Invalid email group hierarchy");
    nearestCountry ??= group.country_id;
    if (group.node_type === "country" && group.country_id) countryAncestor = group.country_id;
    current = group.parent_group_id;
  }
  return countryAncestor ?? nearestCountry;
}
