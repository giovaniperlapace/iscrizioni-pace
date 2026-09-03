import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEventStatisticsSnapshot,
  filterStatisticsPeople,
  parseStatisticsDrilldown,
  serializeStatisticsDrilldown,
} from "../lib/registrations/event-statistics.ts";

test("event statistics count accompanying children in inherited groups and attendance", () => {
  const snapshot = buildEventStatisticsSnapshot({
    participants: [
      {
        registrationId: "registration-family",
        eventId: "event",
        eventTitle: "Assisi 2026",
        currentGroupId: "roma",
        currentGroupName: "Roma",
        country: "Italia",
        city: "Roma",
        childrenCount: 3,
      },
      {
        registrationId: "registration-single",
        eventId: "event",
        eventTitle: "Assisi 2026",
        currentGroupId: "roma",
        currentGroupName: "Roma",
        country: "Italia",
        city: "Roma",
      },
    ],
    groups: [
      {
        id: "roma",
        eventId: "event",
        name: "Roma",
        parentGroupId: null,
        nodeType: "group",
      },
    ],
    attendanceChoices: [
      {
        registration_id: "registration-family",
        day: "2026-10-25",
        day_part: "morning",
        choice: "yes",
      },
      {
        registration_id: "registration-family",
        day: "2026-10-25",
        day_part: "afternoon",
        choice: "yes",
      },
    ],
  });

  assert.equal(snapshot.participantBreakdowns.group[0]?.participantCount, 5);
  assert.equal(
    snapshot.attendanceByDay.find((row) => row.kind === "day")
      ?.participantCount,
    4
  );
  assert.equal(
    snapshot.attendanceByDay.find((row) => row.kind === "missing")
      ?.participantCount,
    1
  );
  assert.equal(snapshot.people.length, 5);
  assert.deepEqual(
    {
      totalPeople: snapshot.summary.totalPeople,
      registeredParticipants: snapshot.summary.registeredParticipants,
      accompanyingChildren: snapshot.summary.accompanyingChildren,
      withoutAttendance: snapshot.summary.withoutAttendance,
    },
    {
      totalPeople: 5,
      registeredParticipants: 2,
      accompanyingChildren: 3,
      withoutAttendance: 1,
    }
  );
  assert.equal(
    snapshot.summary.attendanceSlotCounts["2026-10-25__morning"],
    4
  );
  assert.equal(
    snapshot.summary.attendanceSlotCounts["2026-10-25__afternoon"],
    4
  );
});

test("event statistics build non-overlapping requested age bands at event start", () => {
  const birthDates = [
    ["Age 14", "2012-10-25", "0-14"],
    ["Age 15", "2011-10-25", "15-30"],
    ["Age 30", "1996-10-25", "15-30"],
    ["Age 31", "1995-10-25", "30-65"],
    ["Age 64", "1962-10-25", "30-65"],
    ["Age 65", "1961-10-25", "65+"],
  ] as const;
  const snapshot = buildEventStatisticsSnapshot({
    participants: birthDates.map(([name, birthDate], index) => ({
      registrationId: `registration-${index}`,
      eventId: "event",
      eventTitle: "Assisi 2026",
      name,
      birthDate,
      currentGroupId: null,
      currentGroupName: null,
      country: "Italia",
      city: "Roma",
    })),
    groups: [],
    attendanceChoices: [],
    eventStartsOn: "2026-10-25",
    eventEndsOn: "2026-10-27",
  });

  const bandsByName = new Map(
    snapshot.people.map((person) => [person.name, person.ageBand])
  );

  for (const [name, , expectedBand] of birthDates) {
    assert.equal(bandsByName.get(name), expectedBand);
  }

  assert.deepEqual(snapshot.summary.ageBandCounts, {
    "0-14": 1,
    "15-30": 2,
    "30-65": 2,
    "65+": 1,
    unknown: 0,
  });

  assert.equal(snapshot.attendanceSlots.length, 6);
  assert.equal(snapshot.attendanceSlots[0]?.day, "2026-10-25");
  assert.equal(snapshot.attendanceSlots[0]?.dayPart, "morning");
});

test("event statistics expose only morning and afternoon and expand legacy full-day choices", () => {
  const snapshot = buildEventStatisticsSnapshot({
    participants: [
      {
        registrationId: "registration",
        eventId: "event",
        eventTitle: "Assisi 2026",
        name: "Mario Rossi",
        currentGroupId: null,
        currentGroupName: null,
        country: "Italia",
        city: "Roma",
      },
    ],
    groups: [],
    attendanceChoices: [
      {
        registration_id: "registration",
        day: "2026-10-25",
        day_part: "day",
        choice: "yes",
      },
      {
        registration_id: "registration",
        day: "2026-10-24",
        day_part: "afternoon",
        choice: "yes",
      },
    ],
    eventStartsOn: "2026-10-25",
    eventEndsOn: "2026-10-25",
  });

  assert.deepEqual(
    snapshot.attendanceSlots.map((slot) => slot.key),
    ["2026-10-25__morning", "2026-10-25__afternoon"]
  );
  assert.deepEqual(snapshot.people[0]?.attendanceSlotKeys, [
    "2026-10-25__afternoon",
    "2026-10-25__morning",
  ]);
});

test("statistics drilldown round-trips compound pivot filters", () => {
  const serialized = serializeStatisticsDrilldown({
    country: "Italia",
    city: "Roma",
    group: "Trastevere & Centro",
    attendanceSlot: "2026-10-25__morning",
  });
  const filter = parseStatisticsDrilldown(serialized);

  assert.deepEqual(filter, {
    country: "Italia",
    city: "Roma",
    group: "Trastevere & Centro",
    attendanceSlot: "2026-10-25__morning",
  });

  const matching = filterStatisticsPeople(
    [
      {
        id: "person",
        registrationId: "registration",
        name: "Mario Rossi",
        kind: "participant",
        country: "Italia",
        city: "Roma",
        group: "Trastevere & Centro",
        birthDate: null,
        age: null,
        ageBand: "unknown",
        attendanceSlotKeys: ["2026-10-25__morning"],
        attendanceUnknown: false,
      },
    ],
    filter ?? {}
  );

  assert.equal(matching.length, 1);
});
