import assert from "node:assert/strict";
import test from "node:test";

import {
  getOpeningState,
  isRegistrationAcceptingEvent,
  summarizeRegistrationMonitoring,
} from "../lib/registrations/opening-monitoring.ts";

const NOW = new Date("2026-06-16T12:00:00.000Z");

test("getOpeningState follows event status and registration window", () => {
  assert.equal(
    getOpeningState(
      {
        status: "draft",
        registration_opens_at: "2026-06-01T00:00:00.000Z",
        registration_closes_at: "2026-07-01T00:00:00.000Z",
      },
      NOW
    ),
    "not-published"
  );

  assert.equal(
    getOpeningState(
      {
        status: "published",
        registration_opens_at: "2026-06-20T00:00:00.000Z",
        registration_closes_at: "2026-07-01T00:00:00.000Z",
      },
      NOW
    ),
    "scheduled"
  );

  assert.equal(
    getOpeningState(
      {
        status: "published",
        registration_opens_at: "2026-06-01T00:00:00.000Z",
        registration_closes_at: "2026-06-10T00:00:00.000Z",
      },
      NOW
    ),
    "closed"
  );

  assert.equal(
    isRegistrationAcceptingEvent(
      {
        status: "published",
        registration_opens_at: null,
        registration_closes_at: null,
      },
      NOW
    ),
    true
  );
});

test("summarizeRegistrationMonitoring counts launch watch items", () => {
  const summary = summarizeRegistrationMonitoring(
    [
      {
        submittedAt: "2026-06-16T08:00:00.000Z",
        status: "submitted",
        currentAssignmentStatus: "probable",
        currentAssignmentSource: "participant_selected",
        currentAssignmentReason: null,
        hasCurrentAssignment: true,
        hasQrToken: true,
        needsOperationalSupport: false,
        email: "one@example.org",
      },
      {
        submittedAt: "2026-06-15T11:00:00.000Z",
        status: "submitted",
        currentAssignmentStatus: "probable",
        currentAssignmentSource: "rule",
        currentAssignmentReason: "newcomer",
        hasCurrentAssignment: true,
        hasQrToken: false,
        needsOperationalSupport: true,
        email: "one@example.org",
      },
      {
        submittedAt: "2026-06-14T11:00:00.000Z",
        status: "cancelled",
        currentAssignmentStatus: null,
        currentAssignmentSource: null,
        currentAssignmentReason: null,
        hasCurrentAssignment: false,
        hasQrToken: false,
        needsOperationalSupport: false,
        email: "two@example.org",
      },
    ],
    NOW
  );

  assert.deepEqual(summary, {
    total: 3,
    submitted: 2,
    cancelled: 1,
    last24Hours: 1,
    withoutCurrentGroup: 1,
    probableGroup: 2,
    participantSelectedGroup: 1,
    ruleMatchedGroup: 1,
    newcomerGroup: 1,
    missingQrToken: 2,
    needsOperationalSupport: 1,
    duplicateContactEmails: 1,
  });
});
