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
});
