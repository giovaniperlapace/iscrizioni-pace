import { ACCESSIBILITY_DIFFICULTIES } from "../questionnaire/registration.ts";
import type { StatisticsPersonRow } from "./event-statistics.ts";

export type DisabilityStatisticsPerson = StatisticsPersonRow & {
  declaredDifficulties: string;
  difficultyKeys: Array<typeof ACCESSIBILITY_DIFFICULTIES[number]["key"]>;
};

export type DisabilityStatisticsSnapshot = {
  people: DisabilityStatisticsPerson[];
};


export function countDeclaredDifficulties(people: DisabilityStatisticsPerson[]) {
  return ACCESSIBILITY_DIFFICULTIES.map(({ key, label }) => ({
    key,
    label: label.it,
    count: people.filter(person => person.difficultyKeys.includes(key)).length,
  }));
}

export type DisabilityPeopleSort = "name" | "group" | "difficulty";
export type DisabilityPeopleFilters = {
  difficulty: DisabilityStatisticsPerson["difficultyKeys"][number] | "";
  group: string;
  sort: DisabilityPeopleSort;
  direction: "asc" | "desc";
};

export function disabilityGroupLabel(person: DisabilityStatisticsPerson): string {
  return person.assignedGroupPath.map(node => node.label).join(" → ") || person.assignedGroupLabel;
}

export function disabilityGroupOptions(people: DisabilityStatisticsPerson[]) {
  const options = [...new Map(people.map(person => [person.assignedGroupKey, {
    key: person.assignedGroupKey, label: disabilityGroupLabel(person),
  }])).values()].sort((a,b) => a.label.localeCompare(b.label, "it") || a.key.localeCompare(b.key));
  const totals = new Map<string, number>();
  for (const option of options) totals.set(option.label, (totals.get(option.label) ?? 0) + 1);
  const seen = new Map<string, number>();
  return options.map(option => {
    const index = (seen.get(option.label) ?? 0) + 1;
    seen.set(option.label, index);
    return { ...option, label: totals.get(option.label)! > 1 ? `${option.label} (${index})` : option.label };
  });
}

export function filterAndSortDisabilityPeople(people: DisabilityStatisticsPerson[], filters: DisabilityPeopleFilters) {
  const value = (person: DisabilityStatisticsPerson) => filters.sort === "group"
    ? disabilityGroupLabel(person) : filters.sort === "difficulty" ? person.declaredDifficulties : person.name;
  return people.filter(person => (!filters.difficulty || person.difficultyKeys.includes(filters.difficulty)) &&
    (!filters.group || person.assignedGroupKey === filters.group))
    .sort((a,b) => {
      const comparison = value(a).localeCompare(value(b), "it", { numeric: true, sensitivity: "base" });
      return (filters.direction === "asc" ? comparison : -comparison) || a.registrationId.localeCompare(b.registrationId);
    });
}
