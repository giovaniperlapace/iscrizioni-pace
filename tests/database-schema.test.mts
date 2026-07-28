import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260613120000_initial_schema_and_rls.sql"
);
const participantCodeMigrationPath = join(
  process.cwd(),
  "supabase/migrations/20260615103000_add_participant_public_code.sql"
);
const groupMatchingMigrationPath = join(
  process.cwd(),
  "supabase/migrations/20260616103000_group_tree_matching.sql"
);
const groupLeaderDashboardMigrationPath = join(
  process.cwd(),
  "supabase/migrations/20260616143000_group_leader_dashboard_metadata.sql"
);
const groupTreeSeedMigrationPath = join(
  process.cwd(),
  "supabase/migrations/20260617100000_seed_group_tree_from_model_app.sql"
);
const groupRegistrationLinksMigrationPath = join(
  process.cwd(),
  "supabase/migrations/20260617130000_group_registration_links.sql"
);
const operationalTagsMigrationPath = join(
  process.cwd(),
  "supabase/migrations/20260626100000_operational_tags.sql"
);
const eventServicesMigrationPath = join(
  process.cwd(),
  "supabase/migrations/20260711100000_event_services.sql"
);
const emailCampaignsMigrationPath = join(
  process.cwd(),
  "supabase/migrations/20260712100000_email_campaigns.sql"
);
const futureEventsConsentMigrationPath = join(
  process.cwd(),
  "supabase/migrations/20260720100000_future_events_communications_consent.sql"
);
const emailCampaignAttachmentsMigrationPath = join(
  process.cwd(),
  "supabase/migrations/20260720190000_email_campaign_attachments.sql"
);
const explicitGroupSelectionMigrationPath = join(
  process.cwd(),
  "supabase/migrations/20260726120000_stop_unselected_group_auto_assignment.sql"
);
const groupAgeBandsMigrationPath = join(
  process.cwd(),
  "supabase/migrations/20260727120000_group_age_bands.sql"
);
const multiplePrimaryGroupLeadersMigrationPath = join(
  process.cwd(),
  "supabase/migrations/20260727195000_multiple_primary_group_leaders.sql"
);
const singleGroupRegistrationLinkMigrationPath = join(
  process.cwd(),
  "supabase/migrations/20260728120000_single_group_registration_link.sql"
);
const preventGroupLinkRevocationMigrationPath = join(
  process.cwd(),
  "supabase/migrations/20260728150000_prevent_canonical_group_link_revocation.sql"
);

const migration = readFileSync(migrationPath, "utf8");
const participantCodeMigration = readFileSync(participantCodeMigrationPath, "utf8");
const emailCampaignsMigration = readFileSync(emailCampaignsMigrationPath, "utf8");
const groupMatchingMigration = readFileSync(groupMatchingMigrationPath, "utf8");
const groupLeaderDashboardMigration = readFileSync(
  groupLeaderDashboardMigrationPath,
  "utf8"
);
const groupTreeSeedMigration = readFileSync(groupTreeSeedMigrationPath, "utf8");
const groupRegistrationLinksMigration = readFileSync(
  groupRegistrationLinksMigrationPath,
  "utf8"
);
const operationalTagsMigration = readFileSync(
  operationalTagsMigrationPath,
  "utf8"
);
const eventServicesMigration = readFileSync(eventServicesMigrationPath, "utf8");
const futureEventsConsentMigration = readFileSync(
  futureEventsConsentMigrationPath,
  "utf8"
);
const emailCampaignAttachmentsMigration = readFileSync(
  emailCampaignAttachmentsMigrationPath,
  "utf8"
);
const explicitGroupSelectionMigration = readFileSync(
  explicitGroupSelectionMigrationPath,
  "utf8"
);
const groupAgeBandsMigration = readFileSync(groupAgeBandsMigrationPath, "utf8");
const multiplePrimaryGroupLeadersMigration = readFileSync(
  multiplePrimaryGroupLeadersMigrationPath,
  "utf8"
);
const singleGroupRegistrationLinkMigration = readFileSync(
  singleGroupRegistrationLinkMigrationPath,
  "utf8"
);
const preventGroupLinkRevocationMigration = readFileSync(
  preventGroupLinkRevocationMigrationPath,
  "utf8"
);

const createdTables = Array.from(
  migration.matchAll(/create table public\.([a-z_]+) \(/g),
  (match) => match[1]
);

test("initial database migration enables RLS on every created public table", () => {
  assert.ok(createdTables.length > 0);

  for (const table of createdTables) {
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} enable row level security;`)
    );
  }
});

test("initial database migration defines policies for every created public table", () => {
  for (const table of createdTables) {
    assert.match(
      migration,
      new RegExp(`on public\\.${table} for `),
      `Missing policy for ${table}`
    );
  }
});

test("initial database migration keeps sensitive tables behind scoped helpers", () => {
  const accessibilityPolicies = Array.from(
    migration.matchAll(
      /create policy "[^"]+"\s+on public\.accessibility_needs[\s\S]*?(?=\ncreate policy|\n$)/g
    ),
    (match) => match[0]
  ).join("\n");

  assert.match(migration, /create or replace function app\.can_read_registration/);
  assert.match(migration, /create or replace function app\.can_manage_registration/);
  assert.match(migration, /create or replace function app\.can_check_in/);
  assert.match(migration, /on public\.accessibility_needs for select/);
  assert.doesNotMatch(accessibilityPolicies, /accoglienza/);
});

test("future events consent migration records explicit optional acceptance", () => {
  assert.match(
    futureEventsConsentMigration,
    /future_events_communications_accepted boolean not null default false/
  );
  assert.match(
    futureEventsConsentMigration,
    /future_events_communications_accepted_at timestamptz/
  );
  assert.match(
    futureEventsConsentMigration,
    /future_events_communications_consent_version text/
  );
  assert.match(
    futureEventsConsentMigration,
    /participant_consents_future_events_communications_consistency/
  );
});

test("participant public code migration adds a short generated unique code", () => {
  assert.match(
    participantCodeMigration,
    /add column public_code text/
  );
  assert.match(
    participantCodeMigration,
    /check \(public_code ~ '\^\[A-Z0-9\]\{4\}\$'\)/
  );
  assert.match(
    participantCodeMigration,
    /add constraint participants_public_code_key unique \(public_code\)/
  );
  assert.match(
    participantCodeMigration,
    /create trigger set_participant_public_code/
  );
});

test("group matching migration adds tree metadata and assignment rules", () => {
  assert.match(groupMatchingMigration, /parent_group_id uuid references public\.groups/);
  assert.match(groupMatchingMigration, /node_type text not null default 'group'/);
  assert.match(groupMatchingMigration, /community_kind text not null default 'santegidio'/);
  assert.match(groupMatchingMigration, /age_bracket text not null default 'none'/);
  assert.match(groupMatchingMigration, /create table if not exists public\.group_assignment_rules/);
  assert.match(groupMatchingMigration, /alter table public\.group_assignment_rules enable row level security/);
  assert.match(groupMatchingMigration, /groups public read catalog/);
  assert.match(groupMatchingMigration, /participant_group_assignments_current_unique/);
});

test("group age bands support multiple selections and preserve existing adult coverage", () => {
  assert.match(
    groupAgeBandsMigration,
    /add column if not exists age_brackets text\[\] not null default '\{\}'::text\[\]/
  );
  assert.match(
    groupAgeBandsMigration,
    /array\['giovani', 'adulti', 'anziani'\]::text\[\]/
  );
  assert.match(
    groupAgeBandsMigration,
    /when 'adulti' then array\['adulti', 'anziani'\]::text\[\]/
  );
  assert.match(
    groupAgeBandsMigration,
    /when 'both' then array\['giovani', 'adulti', 'anziani'\]::text\[\]/
  );
});

test("group leader dashboard migration stores internal decision metadata", () => {
  assert.match(groupLeaderDashboardMigration, /leader_internal_note text/);
  assert.match(groupLeaderDashboardMigration, /leader_decision_by uuid references auth\.users/);
  assert.match(groupLeaderDashboardMigration, /leader_decision_at timestamptz/);
  assert.match(groupLeaderDashboardMigration, /leader_notification_read_at timestamptz/);
  assert.match(groupLeaderDashboardMigration, /participant_group_assignments_leader_review_idx/);
});

test("unselected group cleanup only deactivates unconfirmed automatic matches", () => {
  assert.match(explicitGroupSelectionMigration, /assignments\.status = 'probable'/);
  assert.match(explicitGroupSelectionMigration, /assignments\.source = 'rule'/);
  assert.match(
    explicitGroupSelectionMigration,
    /'santegidio_territorial_fallback'/
  );
  assert.match(
    explicitGroupSelectionMigration,
    /'participant_cannot_find_leader'/
  );
  assert.match(explicitGroupSelectionMigration, /is_current = false/);
  assert.match(
    explicitGroupSelectionMigration,
    /participant\.group_auto_assignment_removed/
  );
});

test("model app group tree seed includes Roma areas and primary leaders", () => {
  assert.match(groupTreeSeedMigration, /add column if not exists is_primary boolean/);
  assert.match(groupTreeSeedMigration, /group_memberships_one_primary_per_group_idx/);
  assert.match(groupTreeSeedMigration, /'Monterotondo', 'monterotondo'/);
  assert.match(groupTreeSeedMigration, /'Tivoli', 'tivoli'/);
  assert.match(groupTreeSeedMigration, /'Sezze', 'sezze'/);
  assert.match(groupTreeSeedMigration, /'Universitari', 'giovani', 90, 'Stefano Orlando'/);
  assert.match(
    groupTreeSeedMigration,
    /'Giovani per la pace scuole superiori', 'giovani', 110, 'Laura Guida'/
  );
  assert.match(
    groupTreeSeedMigration,
    /'Giovani per la pace scuole medie', 'giovani', 120, 'Alessandro Natali'/
  );
  assert.match(groupTreeSeedMigration, /'Seminario', 'both'/);
  assert.match(groupTreeSeedMigration, /'Regola seed catalogo gruppi modello app.'/);
});

test("multiple primary group leaders are supported", () => {
  assert.match(
    multiplePrimaryGroupLeadersMigration,
    /drop index if exists public\.group_memberships_one_primary_per_group_idx/
  );
  assert.match(
    multiplePrimaryGroupLeadersMigration,
    /Multiple primary leaders are allowed/
  );
});

test("group registration links migration separates hidden groups from reserved access", () => {
  assert.match(groupRegistrationLinksMigration, /add column if not exists public_label text/);
  assert.match(
    groupRegistrationLinksMigration,
    /create table if not exists public\.group_registration_links/
  );
  assert.match(groupRegistrationLinksMigration, /token_hash text not null unique/);
  assert.match(groupRegistrationLinksMigration, /revoked_at timestamptz/);
  assert.match(
    groupRegistrationLinksMigration,
    /alter table public\.group_registration_links enable row level security/
  );
  assert.match(groupRegistrationLinksMigration, /group registration links read operational/);
  assert.match(groupRegistrationLinksMigration, /group registration links manage direct leaders/);
});

test("each group keeps one reserved registration link even after revocation", () => {
  assert.match(
    singleGroupRegistrationLinkMigration,
    /add column if not exists is_canonical boolean not null default true/
  );
  assert.match(
    singleGroupRegistrationLinkMigration,
    /partition by event_id, group_id/
  );
  assert.match(
    singleGroupRegistrationLinkMigration,
    /create unique index if not exists group_registration_links_one_per_group_idx/
  );
  assert.match(
    singleGroupRegistrationLinkMigration,
    /where is_canonical/
  );
  assert.match(
    singleGroupRegistrationLinkMigration,
    /new\.is_canonical := true/
  );
  assert.doesNotMatch(
    singleGroupRegistrationLinkMigration,
    /where revoked_at is null/
  );
});

test("the canonical group registration link cannot be revoked", () => {
  assert.match(
    preventGroupLinkRevocationMigration,
    /group_registration_links_canonical_not_revoked/
  );
  assert.match(
    preventGroupLinkRevocationMigration,
    /not is_canonical[\s\S]*revoked_at is null and revoked_by is null/
  );
});

test("operational tags migration scopes manager-created tags to event participants", () => {
  assert.match(
    operationalTagsMigration,
    /create table if not exists public\.operational_tags/
  );
  assert.match(
    operationalTagsMigration,
    /create table if not exists public\.participant_operational_tags/
  );
  assert.match(operationalTagsMigration, /operational_tags_event_label_unique/);
  assert.match(
    operationalTagsMigration,
    /create or replace function app\.can_assign_participant_tag/
  );
  assert.match(
    operationalTagsMigration,
    /alter table public\.operational_tags enable row level security/
  );
  assert.match(
    operationalTagsMigration,
    /alter table public\.participant_operational_tags enable row level security/
  );
  assert.match(operationalTagsMigration, /operational tags manage managers/);
  assert.match(
    operationalTagsMigration,
    /participant operational tags assign managers or leaders/
  );
});

test("event services migration separates service catalog from participant assignment", () => {
  assert.match(
    eventServicesMigration,
    /create table if not exists public\.event_services/
  );
  assert.match(
    eventServicesMigration,
    /create table if not exists public\.participant_event_services/
  );
  assert.match(eventServicesMigration, /event_services_event_label_unique/);
  assert.match(
    eventServicesMigration,
    /participant_event_services_one_per_event_participant_idx/
  );
  assert.match(
    eventServicesMigration,
    /participant_event_services_no_self_assignment/
  );
  assert.match(
    eventServicesMigration,
    /create or replace function app\.can_manage_participant_event_service/
  );
  assert.match(
    eventServicesMigration,
    /alter table public\.event_services enable row level security/
  );
  assert.match(
    eventServicesMigration,
    /alter table public\.participant_event_services enable row level security/
  );
  assert.match(eventServicesMigration, /event services manage managers/);
  assert.match(
    eventServicesMigration,
    /participant event services participant preference/
  );
  assert.match(
    eventServicesMigration,
    /participant event services manage operators/
  );
});

test("email campaigns migration versions templates and logs recipient outcomes", () => {
  for (const table of [
    "email_templates",
    "email_template_versions",
    "email_campaigns",
    "email_campaign_recipients",
  ]) {
    assert.match(emailCampaignsMigration, new RegExp(`create table public\\.${table}`));
    assert.match(
      emailCampaignsMigration,
      new RegExp(`alter table public\\.${table} enable row level security`)
    );
  }
  assert.match(emailCampaignsMigration, /recipient_count integer[\s\S]+?between 0 and 100/);
  assert.match(emailCampaignsMigration, /delivery_kind in \('direct','delegated'\)/);
});

test("email campaign attachments use private storage and scoped metadata", () => {
  assert.match(
    emailCampaignAttachmentsMigration,
    /create table public\.email_campaign_attachments/
  );
  assert.match(
    emailCampaignAttachmentsMigration,
    /email_campaign_attachments enable row level security/
  );
  assert.match(
    emailCampaignAttachmentsMigration,
    /'email-campaign-attachments'[\s\S]+?false[\s\S]+?5242880/
  );
  assert.match(
    emailCampaignAttachmentsMigration,
    /email campaign attachments manage managers/
  );
});
