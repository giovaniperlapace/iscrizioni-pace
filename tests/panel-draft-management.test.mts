import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  filterPanelDrafts,
  findPanelScheduleConflict,
  normalizePanelDescription,
  normalizePanelTitle,
  panelCapacityDifference,
  panelDateKey,
  parsePanelCapacity,
  parsePanelDraftFilters,
  parsePanelLocalDateTime,
  type PanelDraftRow,
} from "../lib/panels/panel-drafts.ts";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260805220000_panel_draft_management.sql"),
  "utf8"
);
const actions = readFileSync(join(process.cwd(), "app/actions.ts"), "utf8");
const section = readFileSync(
  join(process.cwd(), "app/dashboard/panel-drafts-section.tsx"),
  "utf8"
);
const fields = readFileSync(
  join(process.cwd(), "app/dashboard/panel-draft-fields.tsx"),
  "utf8"
);

const panels: PanelDraftRow[] = [
  {
    id: "draft",
    eventId: "event",
    title: "Pace e giovani",
    description: "Dialogo",
    startsAt: "2026-10-25T08:00:00.000Z",
    endsAt: "2026-10-25T09:30:00.000Z",
    locationId: "blue",
    locationName: "Sala Blu",
    locationCapacity: 120,
    publicationStatus: "draft",
    publishedAt: null,
    updatedAt: null,
    sections: [],
    assignedCapacity: 100,
  },
  {
    id: "published",
    eventId: "event",
    title: "Città disarmate",
    description: null,
    startsAt: "2026-10-26T10:00:00.000Z",
    endsAt: "2026-10-26T11:00:00.000Z",
    locationId: "green",
    locationName: "Sala Verde",
    locationCapacity: 80,
    publicationStatus: "published",
    publishedAt: "2026-08-05T12:00:00.000Z",
    updatedAt: null,
    sections: [],
    assignedCapacity: 80,
  },
];

test("panel draft inputs normalize text and accept zero-capacity sections", () => {
  assert.equal(normalizePanelTitle("  Pace   e giovani "), "Pace e giovani");
  assert.equal(normalizePanelDescription("  Riga uno\r\nRiga due  "), "Riga uno\nRiga due");
  assert.equal(normalizePanelDescription("   "), null);
  assert.equal(parsePanelCapacity("0"), 0);
  assert.equal(parsePanelCapacity("12"), 12);
  assert.equal(parsePanelCapacity("-1"), null);
  assert.equal(parsePanelCapacity("1.5"), null);
  assert.equal(
    parsePanelLocalDateTime("2026-10-25T09:00")?.toISOString(),
    "2026-10-25T08:00:00.000Z"
  );
});

test("panel filters combine state, date, location and text", () => {
  const filters = parsePanelDraftFilters({
    panelQ: "  giovani ",
    panelStatus: "draft",
    panelDate: "2026-10-25",
    panelLocation: "blue",
  });

  assert.deepEqual(filterPanelDrafts(panels, filters).map((panel) => panel.id), ["draft"]);
  assert.equal(panelDateKey(panels[0].startsAt), "2026-10-25");
  assert.equal(parsePanelDraftFilters({ panelStatus: "bad", panelDate: "25/10" }).status, "all");
  assert.equal(panelCapacityDifference(100, 120), 20);
  assert.equal(panelCapacityDifference(120, 120), 0);
  assert.equal(panelCapacityDifference(130, 120), -10);
});

test("schedule conflicts overlap in one location but allow adjacent panels", () => {
  assert.equal(
    findPanelScheduleConflict(
      {
        locationId: "blue",
        startsAtLocal: "2026-10-25T09:30",
        endsAtLocal: "2026-10-25T10:00",
      },
      panels
    )?.id,
    "draft"
  );
  assert.equal(
    findPanelScheduleConflict(
      {
        locationId: "blue",
        startsAtLocal: "2026-10-25T10:30",
        endsAtLocal: "2026-10-25T11:00",
      },
      panels
    ),
    null
  );
});

test("P3 saves panel and sections atomically with database authorization and audit", () => {
  assert.match(migration, /create or replace function public\.save_panel_draft/);
  assert.match(migration, /security definer/);
  assert.match(migration, /app\.has_event_role\(p_event_id, array\['manager'\]/);
  assert.match(migration, /delete from public\.panel_seat_sections/);
  assert.match(migration, /insert into public\.panel_seat_sections/);
  assert.match(migration, /'panel\.draft_created'/);
  assert.match(migration, /'panel\.draft_updated'/);
  assert.match(migration, /grant execute on function public\.save_panel_draft/);
});

test("server action rejects invalid and duplicate sections and maps overlap errors", () => {
  assert.match(actions, /export async function savePanelDraft/);
  assert.match(actions, /new Set\(normalizedAudienceIds\)\.size/);
  assert.match(actions, /supabase\.rpc\("save_panel_draft"/);
  assert.match(actions, /error\.code === "23P01"/);
  assert.match(actions, /panelError=duplicate-audience/);
});

test("responsive overlay exposes live capacity, conflict and accessible section controls", () => {
  assert.match(section, /md:hidden/);
  assert.match(section, /hidden overflow-x-auto md:block/);
  assert.match(section, /role="dialog"/);
  assert.match(section, /manager viewer/);
  assert.match(fields, /aria-live="polite"/);
  assert.match(fields, /role="alert"/);
  assert.match(fields, /Rimuovi sezione/);
  assert.match(fields, /duplicateAudience/);
  assert.match(fields, /conflictingPanel/);
});
