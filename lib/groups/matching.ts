export const GROUP_MATCHER_VERSION = "2026-06-16-group-tree-v1";

export type GroupAgeBracket = "giovani" | "adulti" | "both" | "none";
export type GroupCommunityKind = "santegidio" | "newcomers" | "territorial";
export type GroupNodeType = "country" | "city" | "area" | "group" | "newcomers";
export type AssignmentSource = "participant_selected" | "rule";

export type GroupMatchCandidate = {
  id: string;
  name: string;
  publicLabel: string | null;
  primaryLeaderName: string | null;
  countryId: string | null;
  cityId: string | null;
  parentGroupId: string | null;
  nodeType: GroupNodeType;
  communityKind: GroupCommunityKind;
  ageBracket: GroupAgeBracket;
  isAssignable: boolean;
  isPublicCatalog: boolean;
  publicOrder: number;
};

export type GroupMatchCriteria = {
  countryId: string | null;
  cityId: string | null;
  birthDate: string | null;
  eventStartsOn: string | null;
};

export type ResolvedGroupAssignment = {
  groupId: string;
  source: AssignmentSource;
  confidence: number;
  reason: string;
  matcherVersion: string;
};

const COUNTRY_SCORE = 30;
const CITY_SCORE = 50;
const AGE_SCORE = 15;
const ASSIGNABLE_SCORE = 5;

export function calculateAgeAtDate(
  birthDate: string | null,
  targetDate: string | null
): number | null {
  const birth = parseDateOnly(birthDate);
  const target = parseDateOnly(targetDate);

  if (!birth || !target || birth.getTime() > target.getTime()) {
    return null;
  }

  let age = target.getUTCFullYear() - birth.getUTCFullYear();
  const targetMonth = target.getUTCMonth();
  const birthMonth = birth.getUTCMonth();
  const hasBirthdayPassed =
    targetMonth > birthMonth ||
    (targetMonth === birthMonth && target.getUTCDate() >= birth.getUTCDate());

  if (!hasBirthdayPassed) {
    age -= 1;
  }

  return age;
}

export function ageTracksForEvent(age: number | null): Set<"giovani" | "adulti"> {
  if (age === null) {
    return new Set(["giovani", "adulti"]);
  }

  if (age >= 23 && age <= 30) {
    return new Set(["giovani", "adulti"]);
  }

  if (age < 30) {
    return new Set(["giovani"]);
  }

  return new Set(["adulti"]);
}

export function findMatchingGroupCandidates(
  groups: GroupMatchCandidate[],
  criteria: GroupMatchCriteria,
  options: {
    communityKind?: GroupCommunityKind;
    publicOnly?: boolean;
  } = {}
): GroupMatchCandidate[] {
  const communityKind = options.communityKind ?? "santegidio";
  const age = calculateAgeAtDate(criteria.birthDate, criteria.eventStartsOn);
  const ageTracks = ageTracksForEvent(age);

  return groups
    .filter((group) => {
      if (!group.isAssignable) {
        return false;
      }

      if (options.publicOnly && !group.isPublicCatalog) {
        return false;
      }

      if (group.communityKind !== communityKind) {
        return false;
      }

      if (!matchesAgeBracket(group.ageBracket, ageTracks)) {
        return false;
      }

      return hasTerritorialMatch(group, criteria);
    })
    .sort((left, right) => {
      const scoreDiff =
        scoreCandidate(right, criteria, ageTracks) -
        scoreCandidate(left, criteria, ageTracks);

      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      return left.publicOrder - right.publicOrder || left.name.localeCompare(right.name);
    });
}

export function findTerritorialFallback(
  groups: GroupMatchCandidate[],
  criteria: GroupMatchCriteria,
  communityKind: GroupCommunityKind
): GroupMatchCandidate | null {
  return (
    findMatchingGroupCandidates(groups, criteria, { communityKind })[0] ??
    groups
      .filter((group) => {
        if (!group.isAssignable || group.communityKind !== communityKind) {
          return false;
        }

        return hasTerritorialMatch(group, criteria);
      })
      .sort(
        (left, right) =>
          scoreTerritory(right, criteria) - scoreTerritory(left, criteria) ||
          left.publicOrder - right.publicOrder ||
          left.name.localeCompare(right.name)
      )[0] ??
    null
  );
}

export function resolveGroupAssignmentForRegistration({
  groups,
  criteria,
  selectedGroupId,
  hasPreviousSantegidioParticipation,
  participatesWithGroup,
  cannotFindLeader,
}: {
  groups: GroupMatchCandidate[];
  criteria: GroupMatchCriteria;
  selectedGroupId: string | null;
  hasPreviousSantegidioParticipation: boolean | null;
  participatesWithGroup: boolean | null;
  cannotFindLeader: boolean;
}): ResolvedGroupAssignment | null {
  if (selectedGroupId && !cannotFindLeader) {
    return {
      groupId: selectedGroupId,
      source: "participant_selected",
      confidence: 0.85,
      reason: "participant_selected_group",
      matcherVersion: GROUP_MATCHER_VERSION,
    };
  }

  if (hasPreviousSantegidioParticipation === false) {
    const fallback = findTerritorialFallback(groups, criteria, "newcomers");

    return fallback
      ? {
          groupId: fallback.id,
          source: "rule",
          confidence: 0.7,
          reason: "newcomer_territorial_fallback",
          matcherVersion: GROUP_MATCHER_VERSION,
        }
      : null;
  }

  if (
    hasPreviousSantegidioParticipation === true &&
    (participatesWithGroup === false || cannotFindLeader || !selectedGroupId)
  ) {
    const fallback = findTerritorialFallback(groups, criteria, "santegidio");

    return fallback
      ? {
          groupId: fallback.id,
          source: "rule",
          confidence: cannotFindLeader ? 0.65 : 0.6,
          reason: cannotFindLeader
            ? "participant_cannot_find_leader"
            : "santegidio_territorial_fallback",
          matcherVersion: GROUP_MATCHER_VERSION,
        }
      : null;
  }

  return null;
}

export function formatGroupOptionLabel(group: {
  name: string;
  primaryLeaderName: string | null;
}): string {
  return group.primaryLeaderName
    ? `${group.name} - referente ${group.primaryLeaderName}`
    : group.name;
}

export function normalizeMatchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function matchesAgeBracket(
  bracket: GroupAgeBracket,
  tracks: Set<"giovani" | "adulti">
): boolean {
  if (bracket === "both" || bracket === "none") {
    return true;
  }

  return tracks.has(bracket);
}

function hasTerritorialMatch(
  group: GroupMatchCandidate,
  criteria: GroupMatchCriteria
): boolean {
  if (criteria.cityId && group.cityId === criteria.cityId) {
    return true;
  }

  if (criteria.countryId && group.countryId === criteria.countryId && !group.cityId) {
    return true;
  }

  return Boolean(
    criteria.countryId &&
      group.countryId === criteria.countryId &&
      !criteria.cityId
  );
}

function scoreCandidate(
  group: GroupMatchCandidate,
  criteria: GroupMatchCriteria,
  tracks: Set<"giovani" | "adulti">
): number {
  return (
    scoreTerritory(group, criteria) +
    (matchesAgeBracket(group.ageBracket, tracks) ? AGE_SCORE : 0) +
    (group.isAssignable ? ASSIGNABLE_SCORE : 0) +
    nodeSpecificityScore(group.nodeType)
  );
}

function scoreTerritory(
  group: GroupMatchCandidate,
  criteria: GroupMatchCriteria
): number {
  if (criteria.cityId && group.cityId === criteria.cityId) {
    return CITY_SCORE + COUNTRY_SCORE;
  }

  if (criteria.countryId && group.countryId === criteria.countryId) {
    return COUNTRY_SCORE;
  }

  return 0;
}

function nodeSpecificityScore(nodeType: GroupNodeType): number {
  switch (nodeType) {
    case "area":
      return 8;
    case "group":
      return 6;
    case "city":
      return 4;
    case "newcomers":
      return 3;
    case "country":
      return 1;
  }
}

function parseDateOnly(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  );
}
