import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  formatPanelProgramDay,
  formatPanelProgramTimeRange,
  getPanelProgramDayKey,
  groupPublicPanelsByDay,
  type PublicPanelProgramItem,
} from "../lib/panels/public-program.ts";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260806090000_public_panel_program.sql"),
  "utf8"
);
const home = readFileSync(join(process.cwd(), "app/page.tsx"), "utf8");
const component = readFileSync(
  join(process.cwd(), "app/public-panel-program.tsx"),
  "utf8"
);

const panels: PublicPanelProgramItem[] = [
  {
    id: "one",
    title: "First",
    description: null,
    startsAt: "2026-10-24T22:30:00.000Z",
    endsAt: "2026-10-24T23:30:00.000Z",
    locationName: "Sala Blu",
    locationAddress: null,
    availability: "available",
  },
  {
    id: "two",
    title: "Second",
    description: "Long description",
    startsAt: "2026-10-25T09:00:00.000Z",
    endsAt: "2026-10-25T10:30:00.000Z",
    locationName: "Sala Verde",
    locationAddress: "Via di Test 2",
    availability: "full",
  },
];

test("public programme groups and formats dates in Europe/Rome", () => {
  assert.equal(getPanelProgramDayKey(panels[0].startsAt), "2026-10-25");
  assert.equal(getPanelProgramDayKey(panels[1].startsAt), "2026-10-25");
  assert.equal(groupPublicPanelsByDay(panels).length, 1);
  assert.equal(formatPanelProgramDay(panels[0].startsAt, "it"), "domenica 25 ottobre");
  assert.equal(formatPanelProgramTimeRange(panels[1].startsAt, panels[1].endsAt, "en"), "10:00–11:30");
});

test("public programme degrades only when the rollout RPC is not installed yet", async () => {
  const missingRpcClient = {
    rpc: async () => ({ data: null, error: { code: "PGRST202" } }),
  };
  const failingClient = {
    rpc: async () => ({ data: null, error: { code: "42501", message: "forbidden" } }),
  };

  const { getPublicPanelProgram } = await import("../lib/panels/public-program.ts");
  assert.deepEqual(await getPublicPanelProgram(missingRpcClient as never), []);
  await assert.rejects(() => getPublicPanelProgram(failingClient as never));
});

test("public RPC exposes only published panels and an aggregate availability state", () => {
  assert.match(migration, /create or replace function public\.get_public_panel_program/);
  assert.match(migration, /security definer/);
  assert.match(migration, /event\.status = 'published'/);
  assert.match(migration, /panel\.publication_status = 'published'/);
  assert.match(migration, /audience\.booking_channel = 'individual'/);
  assert.match(migration, /registration_children/);
  assert.match(migration, /then 'full'/);
  assert.match(migration, /grant execute[\s\S]*to anon, authenticated/);
  assert.doesNotMatch(migration, /returns table \([\s\S]*capacity (integer|bigint)/);
  assert.doesNotMatch(migration, /returns table \([\s\S]*occupied (integer|bigint)/);
});

test("home renders the localized semantic programme and access CTA", () => {
  assert.match(home, /generateMetadata/);
  assert.match(home, /getPublicPanelProgram/);
  assert.match(home, /<PublicPanelProgram/);
  assert.match(component, /aria-labelledby="panel-program-title"/);
  assert.match(component, /<ol/);
  assert.match(component, /<time dateTime=/);
  assert.match(component, /<address/);
  assert.match(component, /href="#personal-access"/);
});
