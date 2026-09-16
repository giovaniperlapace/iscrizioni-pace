import type { GroupMatchCandidate } from "./matching.ts";

/** Resolve missing geography without changing persisted groups or public visibility. */
export function inheritGroupTerritories(groups: GroupMatchCandidate[]): GroupMatchCandidate[] {
  const byId = new Map(groups.map(group => [group.id, group]));
  return groups.map(group => {
    let countryId = group.countryId;
    let cityId = group.cityId;
    const visited = new Set([group.id]);
    let parentId = group.parentGroupId;
    while (parentId) {
      if (visited.has(parentId)) throw new Error("Cyclic group territory hierarchy");
      visited.add(parentId);
      const parent = byId.get(parentId);
      if (!parent) throw new Error("Incomplete group territory hierarchy");
      // A country's explicit override must not inherit a city from another country.
      if (countryId && parent.countryId && countryId !== parent.countryId) {
        throw new Error("Conflicting group territory hierarchy");
      }
      countryId ??= parent.countryId;
      cityId ??= parent.cityId;
      parentId = parent.parentGroupId;
    }
    return { ...group, countryId, cityId };
  });
}
