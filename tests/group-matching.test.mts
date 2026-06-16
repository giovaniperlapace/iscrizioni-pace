import assert from "node:assert/strict";
import test from "node:test";

import {
  ageTracksForEvent,
  calculateAgeAtDate,
  findMatchingGroupCandidates,
  findTerritorialFallback,
  resolveGroupAssignmentForRegistration,
  type GroupMatchCandidate,
} from "../lib/groups/matching.ts";

const ITALY = "11111111-1111-4111-8111-111111111111";
const AUSTRIA = "22222222-2222-4222-8222-222222222222";
const ROME = "33333333-3333-4333-8333-333333333333";
const TURIN = "44444444-4444-4444-8444-444444444444";

const groups: GroupMatchCandidate[] = [
  group({
    id: "roma-area",
    name: "Roma Torrevecchia",
    countryId: ITALY,
    cityId: ROME,
    nodeType: "area",
    ageBracket: "both",
    publicOrder: 10,
  }),
  group({
    id: "roma-giovani",
    name: "Roma - Giovani per la Pace",
    countryId: ITALY,
    cityId: ROME,
    ageBracket: "giovani",
    publicOrder: 20,
  }),
  group({
    id: "roma-adulti",
    name: "Roma adulti",
    countryId: ITALY,
    cityId: ROME,
    ageBracket: "adulti",
    publicOrder: 30,
  }),
  group({
    id: "torino-giovani",
    name: "Torino - Giovani per la Pace",
    countryId: ITALY,
    cityId: TURIN,
    ageBracket: "giovani",
    publicOrder: 40,
  }),
  group({
    id: "austria",
    name: "Austria",
    countryId: AUSTRIA,
    cityId: null,
    nodeType: "country",
    ageBracket: "both",
    publicOrder: 50,
  }),
  group({
    id: "newcomers-italy",
    name: "Nuovi partecipanti - Italia",
    countryId: ITALY,
    cityId: null,
    nodeType: "newcomers",
    communityKind: "newcomers",
    isPublicCatalog: false,
    publicOrder: 900,
  }),
  group({
    id: "newcomers-rome",
    name: "Nuovi partecipanti - Roma",
    countryId: ITALY,
    cityId: ROME,
    nodeType: "newcomers",
    communityKind: "newcomers",
    isPublicCatalog: false,
    publicOrder: 910,
  }),
];

test("calculateAgeAtDate uses the event date, not the current date", () => {
  assert.equal(calculateAgeAtDate("2000-10-25", "2026-10-24"), 25);
  assert.equal(calculateAgeAtDate("2000-10-25", "2026-10-25"), 26);
});

test("age tracks overlap from 23 through 30", () => {
  assert.deepEqual([...ageTracksForEvent(22)], ["giovani"]);
  assert.deepEqual([...ageTracksForEvent(23)], ["giovani", "adulti"]);
  assert.deepEqual([...ageTracksForEvent(30)], ["giovani", "adulti"]);
  assert.deepEqual([...ageTracksForEvent(31)], ["adulti"]);
});

test("matching uses country fallback when Austria has no city node", () => {
  const candidates = findMatchingGroupCandidates(groups, {
    countryId: AUSTRIA,
    cityId: null,
    birthDate: "1990-01-01",
    eventStartsOn: "2026-10-25",
  });

  assert.equal(candidates[0]?.id, "austria");
});

test("matching prefers the closest Roma area before broader city groups", () => {
  const candidates = findMatchingGroupCandidates(groups, {
    countryId: ITALY,
    cityId: ROME,
    birthDate: "2004-01-01",
    eventStartsOn: "2026-10-25",
  });

  assert.equal(candidates[0]?.id, "roma-area");
  assert.ok(candidates.some((candidate) => candidate.id === "roma-giovani"));
  assert.ok(!candidates.some((candidate) => candidate.id === "torino-giovani"));
});

test("new participants resolve to the closest territorial newcomers node", () => {
  const assignment = resolveGroupAssignmentForRegistration({
    groups,
    criteria: {
      countryId: ITALY,
      cityId: ROME,
      birthDate: "1998-01-01",
      eventStartsOn: "2026-10-25",
    },
    selectedGroupId: null,
    hasPreviousSantegidioParticipation: false,
    participatesWithGroup: null,
    cannotFindLeader: false,
  });

  assert.equal(assignment?.groupId, "newcomers-rome");
  assert.equal(assignment?.source, "rule");
  assert.equal(assignment?.reason, "newcomer_territorial_fallback");
});

test("Sant'Egidio participants without a selected leader get a probable rule assignment", () => {
  const assignment = resolveGroupAssignmentForRegistration({
    groups,
    criteria: {
      countryId: ITALY,
      cityId: ROME,
      birthDate: "2000-01-01",
      eventStartsOn: "2026-10-25",
    },
    selectedGroupId: null,
    hasPreviousSantegidioParticipation: true,
    participatesWithGroup: true,
    cannotFindLeader: true,
  });

  assert.equal(assignment?.groupId, "roma-area");
  assert.equal(assignment?.source, "rule");
  assert.equal(assignment?.reason, "participant_cannot_find_leader");
});

test("territorial fallback can climb from city to country", () => {
  const fallback = findTerritorialFallback(
    groups,
    {
      countryId: AUSTRIA,
      cityId: "99999999-9999-4999-8999-999999999999",
      birthDate: "1990-01-01",
      eventStartsOn: "2026-10-25",
    },
    "santegidio"
  );

  assert.equal(fallback?.id, "austria");
});

function group(
  overrides: Partial<GroupMatchCandidate> & Pick<GroupMatchCandidate, "id" | "name">
): GroupMatchCandidate {
  return {
    primaryLeaderName: "Referente",
    countryId: null,
    cityId: null,
    parentGroupId: null,
    nodeType: "group",
    communityKind: "santegidio",
    ageBracket: "none",
    isAssignable: true,
    isPublicCatalog: true,
    publicOrder: 100,
    ...overrides,
  };
}
