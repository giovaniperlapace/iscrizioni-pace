import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("P9 persists teachers as a distinct campaign audience", async () => {
  const [migration, recipients, delivery] = await Promise.all([
    read("supabase/migrations/20260806200000_panel_campaign_audiences.sql"),
    read("lib/email/campaign-recipients.server.ts"),
    read("lib/email/campaign-delivery.server.ts"),
  ]);

  assert.match(migration, /recipient_type in \('participant', 'group_leader', 'teacher'\)/);
  assert.match(migration, /school_teacher_id uuid/);
  assert.match(migration, /delivery_kind = 'teacher'/);
  assert.match(recipients, /recipientKey: `teacher:\$\{teacher\.id\}`/);
  assert.match(recipients, /new Set\(\(bookings \?\? \[\]\)[\s\S]*teacher_id/);
  assert.match(delivery, /recipient\.recipientType === "teacher"/);
  assert.match(delivery, /provider_message_id: hashMessageId\(result\.messageId\)/);
});

test("P9 panel filters use current canonical confirmed choices", async () => {
  const [recipients, composer, emailSection, panelSection] = await Promise.all([
    read("lib/email/campaign-recipients.server.ts"),
    read("app/dashboard/manager/email/email-campaign-composer.tsx"),
    read("app/dashboard/manager/email/email-section.tsx"),
    read("app/dashboard/panel-drafts-section.tsx"),
  ]);

  assert.match(recipients, /from\("moment_attendance_choices"\)/);
  assert.match(recipients, /\.eq\("choice", "yes"\)/);
  assert.match(recipients, /\.not\("seat_section_id", "is", null\)/);
  assert.match(composer, /label="Panel"/);
  assert.match(composer, /recipient\.panelIds\.some/);
  assert.match(emailSection, /\.eq\("publication_status", "published"\)/);
  assert.match(emailSection, /locationNameById/);
  assert.match(emailSection, /initialPanelId=\{initialPanelId\}/);
  assert.match(panelSection, /campaignPanel=\$\{encodeURIComponent\(panel\.id\)\}/);
});

test("P9 keeps professor selection explicit and separate", async () => {
  const [composer, route] = await Promise.all([
    read("app/dashboard/manager/email/email-campaign-composer.tsx"),
    read("app/api/email-campaigns/route.ts"),
  ]);

  assert.match(composer, />\s*Professori\s*</);
  assert.match(composer, /setSelectedRecipientIds\(\[\]\)/);
  assert.match(composer, /schoolNames/);
  assert.match(composer, /setAllFilteredRecipientsSelected/);
  assert.match(route, /selectedRecipientKeys/);
  assert.match(route, /body\.audience === "teachers"/);
  assert.match(route, /role\.role === "manager" && role\.eventId === eventId/);
});

test("campaign templates expose teacher-specific school and panel fields", async () => {
  const templates = await read("lib/email/campaign-templates.ts");
  assert.match(templates, /\{ token: "\{\{scuola\}\}"/);
  assert.match(templates, /\{ token: "\{\{panel\}\}"/);
});
