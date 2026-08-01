import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const adminDashboard = readFileSync(
  join(process.cwd(), "app/dashboard/admin/page.tsx"),
  "utf8"
);
const managerDashboard = readFileSync(
  join(process.cwd(), "app/dashboard/manager/page.tsx"),
  "utf8"
);
const participantsSection = readFileSync(
  join(process.cwd(), "app/dashboard/operations-participants-section.tsx"),
  "utf8"
);
const deleteButton = readFileSync(
  join(
    process.cwd(),
    "app/dashboard/participants/registration-delete-button.tsx"
  ),
  "utf8"
);
const deleteRoute = readFileSync(
  join(process.cwd(), "app/dashboard/participants/delete/route.ts"),
  "utf8"
);

test("admin and manager share the confirmed registration deletion control", () => {
  assert.match(adminDashboard, /<OperationsParticipantsSection/);
  assert.match(managerDashboard, /<OperationsParticipantsSection/);
  assert.match(adminDashboard, /canDeleteRegistration/);
  assert.match(managerDashboard, /canDeleteRegistration/);
  assert.match(participantsSection, /action="\/dashboard\/participants\/delete"/);
  assert.match(participantsSection, /name="sourceDashboard" value=\{dashboard\}/);
  assert.match(participantsSection, /<RegistrationDeleteButton participantName=/);
  assert.match(deleteButton, /window\.confirm\(/);
  assert.match(deleteButton, /Elimina iscrizione/);
  assert.match(deleteButton, /L'account di accesso non verrà cancellato/);
});

test("registration deletion allows scoped managers and keeps participant and auth records", () => {
  assert.match(deleteRoute, /eventRole\.role === "admin"/);
  assert.match(
    deleteRoute,
    /eventRole\.role === "manager" && eventRole\.eventId === registrationRow\.event_id/
  );
  assert.match(deleteRoute, /\.from\("registrations"\)[\s\S]*?\.delete\(\)/);
  assert.match(deleteRoute, /\.eq\("id", registrationId\)/);
  assert.match(deleteRoute, /\.eq\("participant_id", participantId\)/);
  assert.doesNotMatch(deleteRoute, /\.from\("participants"\)[\s\S]*?\.delete\(\)/);
  assert.match(deleteRoute, /"admin\.registration_deleted"/);
  assert.match(deleteRoute, /"manager\.registration_deleted"/);
  assert.match(deleteRoute, /participant_record_retained: true/);
  assert.match(deleteRoute, /auth_account_retained: true/);
});
