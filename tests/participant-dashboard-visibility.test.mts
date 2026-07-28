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
  participantDashboard.indexOf("function SummaryInfo")
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
