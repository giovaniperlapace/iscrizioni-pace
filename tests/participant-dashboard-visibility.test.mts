import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const participantDashboard = readFileSync(
  join(process.cwd(), "app/dashboard/partecipante/page.tsx"),
  "utf8"
);

const registrationSummary = participantDashboard.slice(
  participantDashboard.indexOf("function RegistrationSummaryCard"),
  participantDashboard.indexOf("function ParticipantOrganizerContactCard")
);

const organizerContactCard = participantDashboard.slice(
  participantDashboard.indexOf("function ParticipantOrganizerContactCard"),
  participantDashboard.indexOf("function ChevronIcon")
);

test("participant dashboard keeps group and leader assignments internal", () => {
  assert.doesNotMatch(participantDashboard, /participant_group_assignments/);
  assert.doesNotMatch(registrationSummary, /copy\.(group|leader)/);
});

test("registration summary shows only assigned services and does not duplicate panels", () => {
  assert.match(
    registrationSummary,
    /\{serviceLabel \? \([\s\S]*?<SummaryInfo label=\{copy\.eventService\} value=\{serviceLabel\} \/>[\s\S]*?\) : null\}/
  );
  assert.doesNotMatch(registrationSummary, /copy\.panelsTitle|selectedPanels/);
});

test("participant registration overlay allows editing first and last name", () => {
  assert.match(participantDashboard, /name="updatesIdentity" value="on"/);
  assert.match(participantDashboard, /name="firstName"/);
  assert.match(participantDashboard, /autoComplete="given-name"/);
  assert.match(participantDashboard, /name="lastName"/);
  assert.match(participantDashboard, /autoComplete="family-name"/);
});

test("organizer contact is a dedicated help card outside registration details", () => {
  assert.doesNotMatch(registrationSummary, /overlay=messaggio/);
  assert.match(organizerContactCard, /copy\.helpTitle/);
  assert.match(organizerContactCard, /copy\.helpBody/);
  assert.match(organizerContactCard, /overlay=messaggio/);
});
