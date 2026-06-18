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
import {
  collectDescendantGroupIds,
  getEscalationTargetGroupId,
  matchesGroupLeaderFilter,
  normalizeLeaderInternalNote,
  summarizeGroupLeaderAssignments,
} from "../lib/groups/capogruppo-dashboard.ts";
import {
  buildGroupRegistrationUrl,
  createGroupRegistrationLinkToken,
  getGroupRegistrationDisplayLabel,
  getGroupRegistrationLinkStatus,
  hashGroupRegistrationLinkToken,
  isValidGroupRegistrationLinkToken,
  normalizeGroupRegistrationPublicLabel,
} from "../lib/groups/registration-links.ts";

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

test("group leader scope includes descendant groups", () => {
  const scoped = collectDescendantGroupIds(
    [
      { id: "italy", parentGroupId: null },
      { id: "rome", parentGroupId: "italy" },
      { id: "rome-area", parentGroupId: "rome" },
      { id: "vienna", parentGroupId: null },
    ],
    ["italy"]
  );

  assert.deepEqual([...scoped], ["italy", "rome", "rome-area"]);
});

test("group leader rejection escalates to the direct parent", () => {
  const groupsById = new Map([
    ["italy", { id: "italy", parentGroupId: null }],
    ["rome", { id: "rome", parentGroupId: "italy" }],
  ]);

  assert.equal(getEscalationTargetGroupId(groupsById, "rome"), "italy");
  assert.equal(getEscalationTargetGroupId(groupsById, "italy"), null);
});

test("group leader summary tracks assignments that need review", () => {
  const summary = summarizeGroupLeaderAssignments([
    { status: "probable", isCurrent: true, leaderNotificationReadAt: null },
    { status: "probable", isCurrent: true, leaderNotificationReadAt: "2026-06-16T10:00:00Z" },
    { status: "confirmed", isCurrent: true, leaderNotificationReadAt: null },
    { status: "rejected", isCurrent: false, leaderNotificationReadAt: null },
  ]);

  assert.deepEqual(summary, {
    total: 4,
    toReview: 1,
    probable: 2,
    confirmed: 1,
    rejected: 1,
  });
  assert.equal(
    matchesGroupLeaderFilter(
      { status: "probable", isCurrent: true, leaderNotificationReadAt: null },
      "to-review"
    ),
    true
  );
});

test("group leader internal notes are compacted and bounded", () => {
  assert.equal(normalizeLeaderInternalNote("  una   nota\ninterna  "), "una nota interna");
  assert.equal(normalizeLeaderInternalNote("   "), null);
  assert.equal(normalizeLeaderInternalNote("a".repeat(900))?.length, 800);
});

test("reserved group registration links use opaque valid tokens", () => {
  const token = createGroupRegistrationLinkToken();

  assert.equal(isValidGroupRegistrationLinkToken(token), true);
  assert.match(hashGroupRegistrationLinkToken(token), /^[a-f0-9]{64}$/);
  assert.equal(isValidGroupRegistrationLinkToken("gruppo-sensibile"), false);
});

test("reserved group registration labels prefer link label over group label", () => {
  assert.equal(
    normalizeGroupRegistrationPublicLabel("  Gruppo   indicato\n "),
    "Gruppo indicato"
  );
  assert.equal(
    getGroupRegistrationDisplayLabel({
      linkPublicLabel: "Invito referente",
      groupPublicLabel: "Label gruppo",
    }),
    "Invito referente"
  );
  assert.equal(
    getGroupRegistrationDisplayLabel({
      linkPublicLabel: null,
      groupPublicLabel: null,
    }),
    "Gruppo indicato dal tuo referente"
  );
});

test("reserved group registration link status handles revocation and use limits", () => {
  assert.equal(
    getGroupRegistrationLinkStatus({
      expiresAt: null,
      revokedAt: null,
      maxUses: null,
      useCount: 0,
      now: new Date("2026-06-17T12:00:00Z"),
    }),
    "active"
  );
  assert.equal(
    getGroupRegistrationLinkStatus({
      expiresAt: null,
      revokedAt: "2026-06-17T11:00:00Z",
      maxUses: null,
      useCount: 0,
      now: new Date("2026-06-17T12:00:00Z"),
    }),
    "revoked"
  );
  assert.equal(
    getGroupRegistrationLinkStatus({
      expiresAt: null,
      revokedAt: null,
      maxUses: 2,
      useCount: 2,
      now: new Date("2026-06-17T12:00:00Z"),
    }),
    "exhausted"
  );
});

test("reserved group registration URL keeps the token in a query parameter", () => {
  const url = buildGroupRegistrationUrl({
    appUrl: "https://registrationspeace.santegidio.org/",
    token: "abc_DEF-123",
    email: "persona@example.org",
  });

  assert.equal(
    url,
    "https://registrationspeace.santegidio.org/registrazione?groupLink=abc_DEF-123&email=persona%40example.org"
  );
});

function group(
  overrides: Partial<GroupMatchCandidate> & Pick<GroupMatchCandidate, "id" | "name">
): GroupMatchCandidate {
  return {
    primaryLeaderName: "Referente",
    publicLabel: null,
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
