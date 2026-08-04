import assert from "node:assert/strict";
import test from "node:test";

import { buildEventStatisticsSnapshot } from "../lib/registrations/event-statistics.ts";

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

  assert.equal(snapshot.attendanceSlots.length, 7);
  assert.equal(snapshot.attendanceSlots[0]?.day, "2026-10-24");
  assert.equal(snapshot.attendanceSlots[0]?.dayPart, "afternoon");
});
