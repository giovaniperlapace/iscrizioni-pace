import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { buildHomePreview } from "../lib/panels/home-preview.ts";
import { getGeneralHomeProgram, getHomeProgram } from "../lib/events/home-program.ts";
import { formatPanelProgramDay } from "../lib/panels/public-program.ts";
import type { PanelDraftRow } from "../lib/panels/panel-drafts.ts";
import type { EventLocationOption } from "../lib/panels/event-locations.ts";

const location: EventLocationOption = { id: "room", eventId: "event", name: "Sala corrente", address: "Indirizzo corrente", maxCapacity: 200, isActive: true, panels: [] };
const panel: PanelDraftRow = { id: "panel", eventId: "event", title: "Bozza del gestionale", description: null, startsAt: "2026-10-26T08:30:00Z", endsAt: "2026-10-26T11:30:00Z", locationId: "room", locationName: "Vecchio nome", locationCapacity: 200, publicationStatus: "draft", publishedAt: null, updatedAt: null, confirmedRegistrationCount: 0, assignedCapacity: 100, sections: [ { id: "individual", audienceTypeId: "people", audienceName: "Iscritti", bookingChannel: "individual", capacity: 70, occupied: 20 }, { id: "guests", audienceTypeId: "guests", audienceName: "Ospiti", bookingChannel: "internal_assignment", capacity: 30, occupied: 0 } ] };

test("private preview includes drafts and propagates current titles, dates, locations and individual seats", () => {
  const first = buildHomePreview([panel], [location]).panels[0];
  assert.equal(first.publicationStatus, "draft");
  assert.equal(first.remainingSeats, 50);
  assert.equal(first.locationName, location.name);
  assert.equal(first.locationAddress, location.address);
  const changed = { ...panel, title: "Titolo aggiornato", startsAt: "2026-10-27T09:00:00Z", sections: [{ ...panel.sections[0], capacity: 20, occupied: 20 }] };
  const next = buildHomePreview([changed], [{ ...location, name: "Nuova sala" }]).panels[0];
  assert.equal(next.title, changed.title);
  assert.equal(next.startsAt, changed.startsAt);
  assert.equal(next.locationName, "Nuova sala");
  assert.equal(next.remainingSeats, 0);
  assert.equal(next.availability, "full");
  assert.equal(panel.title, "Bozza del gestionale");
});

test("incomplete drafts remain visible and missing occupancy fails instead of inventing availability", () => {
  const result = buildHomePreview([{ ...panel, startsAt: null }, panel], [location]);
  assert.equal(result.incomplete.length, 1);
  assert.equal(result.panels.length, 1);
  assert.throws(() => buildHomePreview([{ ...panel, sections: [{ ...panel.sections[0], occupied: undefined }] }], [location]));
  assert.equal(buildHomePreview([{ ...panel, sections: [panel.sections[1]] }], [location]).panels[0].availability, "unavailable");
});

test("official general programme has correct Rome start times across the daylight saving change, in seven languages", () => {
  for (const locale of ["it", "en", "fr", "de", "es", "nl", "uk"] as const) {
    const items = getGeneralHomeProgram(locale);
    assert.equal(items.length, 3);
    assert.ok(items.every(item => item.title && item.location));
    assert.equal(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" }).format(new Date(items[0].startsAt)), "16:30");
  }
  assert.equal(formatPanelProgramDay(getGeneralHomeProgram("it")[0].startsAt, "it"), "domenica 25 ottobre");
});

test("private route uses the established role/scope guard before all loaders; public internal home returns before the programme", () => {
  const route = readFileSync(new URL("../app/dashboard/anteprima-home/page.tsx", import.meta.url), "utf8");
  assert.ok(route.indexOf("await requirePanelManager()") < route.indexOf('db.from("events")'));
  assert.match(route, /index: false, follow: false/);
  assert.match(route, /bookingsOpen=\{false\} preview/);
  const home = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.ok(home.indexOf('if (releaseMode === "internal")') < home.indexOf("const panels = await"));
  assert.match(home, /return <RegistrationHome/);
});

test("preview button is available in Admin only, removed from Manager as requested", () => {
  const catalog = readFileSync(new URL("../app/dashboard/panel-drafts-section.tsx", import.meta.url), "utf8");
  assert.match(catalog, /canManage && dashboard === "admin" \? <Link href="\/dashboard\/anteprima-home"/);
});

test("programme merges actual panel slots chronologically, deduplicating only identical start/end instants", () => {
  const base = buildHomePreview([panel], [location]).panels[0];
  const panels = [
    { ...base, id: "morning", startsAt: "2026-10-26T09:30:00+01:00", endsAt: "2026-10-26T12:30:00+01:00" },
    { ...base, id: "same-slot", startsAt: "2026-10-26T08:30:00Z", endsAt: "2026-10-26T11:30:00Z" },
    { ...base, id: "afternoon", startsAt: "2026-10-26T16:00:00+01:00", endsAt: "2026-10-26T18:00:00+01:00" },
    { ...base, id: "exception", startsAt: "2026-10-26T17:00:00+01:00", endsAt: "2026-10-26T18:00:00+01:00" },
    { ...base, id: "next-day", startsAt: "2026-10-27T09:30:00+01:00", endsAt: "2026-10-27T12:30:00+01:00" },
  ];
  const result = getHomeProgram("it", panels);
  assert.equal(result.length, 7);
  assert.equal(result.filter(item => item.isPanelSlot).length, 4);
  assert.equal(result[0].id, "opening");
  assert.equal(result[1].title, "Panel in vari luoghi");
  assert.equal(result[1].endsAt, panels[0].endsAt);
  assert.equal(result.at(-1)?.id, "closing");
  assert.equal(panels[0].id, "morning");
  assert.equal(getHomeProgram("it", []).length, 3);
  for (const locale of ["it", "en", "fr", "de", "es", "nl", "uk"] as const) assert.ok(getHomeProgram(locale, [base]).find(item => item.isPanelSlot)?.title);
});
