import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEventStatisticsSnapshot,
  buildAssignedGroupRows,
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

  assert.equal(snapshot.attendanceSlots.length, 7);
  assert.equal(snapshot.attendanceSlots[0]?.day, "2026-10-24");
  assert.equal(snapshot.attendanceSlots[0]?.dayPart, "afternoon");
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
    ["2026-10-24__afternoon", "2026-10-25__morning", "2026-10-25__afternoon"]
  );
  assert.deepEqual(snapshot.people[0]?.attendanceSlotKeys, [
    "2026-10-24__afternoon",
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
        assignedGroupKey: "event:group",
        assignedGroupPath: [],
        assignedGroupLabel: "Trastevere & Centro",
        assignedGroupType: "Gruppo effettivo",
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

test("direct assigned nodes ignore residence and ancestors, separate namesakes and preserve drilldowns", () => {
  const groups = [
    { id: "country", name: "Italia", nodeType: "country", isAssignable: true },
    { id: "city", name: "Roma", nodeType: "city", isAssignable: true },
    { id: "area", name: "Centro", nodeType: "area", isAssignable: true },
    { id: "one", name: "Omonimo", nodeType: "group", isAssignable: true },
    { id: "two", name: "Omonimo", nodeType: "group", isAssignable: false },
    { id: "closed", name: "Organizzazione", nodeType: "area", isAssignable: false },
  ].map(g => ({ ...g, eventId: "event", parentGroupId: g.id === "country" ? null : "country" }));
  const snapshot = buildEventStatisticsSnapshot({
    groups,
    participants: [...groups.map(g => g.id), null].map((id, i) => ({
      registrationId: `r${i}`, eventId: "event", eventTitle: "Evento",
      currentGroupId: id, currentGroupName: "Nome obsoleto", country: "Francia", city: "Parigi",
      childrenCount: i === 0 ? 2 : 0,
    })),
    attendanceChoices: [{ registration_id: "r0", day: "2026-10-25", day_part: "morning", choice: "yes" }],
  });
  const rows = buildAssignedGroupRows(snapshot.people);
  assert.equal(rows.length, 7);
  assert.equal(rows.reduce((sum, row) => sum + row.people.length, 0), 9);
  assert.equal(rows.find(r => r.label === "Italia")?.people.length, 3);
  assert.equal(rows.find(r => r.label === "Roma")?.type, "Città");
  assert.equal(rows.find(r => r.label === "Centro")?.type, "Area");
  assert.equal(rows.find(r => r.label === "Organizzazione")?.type, "Nodo non iscrivibile");
  assert.equal(rows.filter(r => r.label === "Omonimo").length, 2);
  assert.ok(!rows.some(r => ["Francia", "Parigi", "Nome obsoleto"].includes(r.label)));
  for (const row of rows) {
    const filter = parseStatisticsDrilldown(serializeStatisticsDrilldown(row.filter))!;
    assert.deepEqual(filterStatisticsPeople(snapshot.people, filter), row.people);
    assert.equal(filterStatisticsPeople(snapshot.people, { ...filter, attendanceSlot: "2026-10-25__morning" }).length, row.label === "Italia" ? 3 : 0);
  }
});

test("legacy registrations missing birth, city and email remain in statistics with their children", () => {
  const snapshot = buildEventStatisticsSnapshot({
    participants: [{ registrationId: "legacy", eventId: "event", eventTitle: "Event",
      birthDate: null, city: null, country: "Germania", currentGroupId: "germany",
      currentGroupName: "Germania", childrenCount: 2 }],
    groups: [{ id: "germany", eventId: "event", name: "Germania", parentGroupId: null, nodeType: "country" }],
    attendanceChoices: [],
  });
  assert.equal(snapshot.summary.registeredParticipants, 1);
  assert.equal(snapshot.summary.accompanyingChildren, 2);
  assert.equal(snapshot.summary.totalPeople, 3);
  assert.equal(snapshot.people.length, 3);
  assert.equal(snapshot.participantBreakdowns.group[0].participantCount, 3);
});


test("arrival afternoon counts include accompanying children and preserve exact drilldowns", () => {
  const snapshot = buildEventStatisticsSnapshot({
    participants: ["arrival", "unknown"].map(registrationId => ({
      registrationId, eventId: "event", eventTitle: "Assisi", currentGroupId: null,
      currentGroupName: null, country: null, city: null, childrenCount: registrationId === "arrival" ? 1 : 0,
    })), groups: [],
    attendanceChoices: [
      { registration_id: "arrival", day: "2026-10-24", day_part: "afternoon", choice: "yes" },
      { registration_id: "arrival", day: "2026-10-24", day_part: "day", choice: "yes" },
      { registration_id: "arrival", day: "2026-10-23", day_part: "afternoon", choice: "yes" },
      { registration_id: "unknown", day: null, choice: "unknown" },
    ], eventStartsOn: "2026-10-25", eventEndsOn: "2026-10-27",
  });
  assert.equal(snapshot.summary.attendanceSlotCounts["2026-10-24__afternoon"], 2);
  assert.equal(snapshot.summary.attendanceSlotCounts["2026-10-24__morning"], undefined);
  assert.equal(snapshot.summary.withoutAttendance, 1);
  assert.equal(snapshot.attendanceSlots.some(slot => slot.day === "2026-10-23"), false);
  const people = filterStatisticsPeople(snapshot.people, { attendanceSlot: "2026-10-24__afternoon" });
  assert.equal(people.length, 2);
  assert.deepEqual(people.map(person => person.kind).sort(), ["child", "participant"]);
  assert.ok(people.every(person => person.registrationId === "arrival"));
});
