import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  buildPanelStatisticsSnapshot,
  type PanelStatisticsAudienceInput,
  type PanelStatisticsLocationInput,
  type PanelStatisticsPanelInput,
  type PanelStatisticsSectionInput,
} from "../lib/panels/panel-statistics.ts";

const reportSource = readFileSync(
  join(process.cwd(), "app/dashboard/panel-statistics-report.tsx"),
  "utf8"
);
const statisticsSource = readFileSync(
  join(process.cwd(), "lib/panels/panel-statistics.ts"),
  "utf8"
);

const audiences: PanelStatisticsAudienceInput[] = [
  {
    id: "individual",
    name: "Iscritti",
    bookingChannel: "individual",
  },
  {
    id: "school",
    name: "Scuole",
    bookingChannel: "school_booking",
  },
];
const locations: PanelStatisticsLocationInput[] = [
  { id: "location", name: "Sala Pace", maxCapacity: 30 },
];
const panels: PanelStatisticsPanelInput[] = [
  {
    id: "panel",
    title: "Pace e città",
    startsAt: "2026-10-25T08:00:00.000Z",
    endsAt: "2026-10-25T09:00:00.000Z",
    locationId: "location",
    publicationStatus: "published",
  },
];
const sections: PanelStatisticsSectionInput[] = [
  {
    id: "individual-section",
    panelId: "panel",
    audienceTypeId: "individual",
    capacity: 5,
  },
  {
    id: "school-section",
    panelId: "panel",
    audienceTypeId: "school",
    capacity: 25,
  },
];

test("P10 reconciles adults, inherited children and school people by section", () => {
  const snapshot = buildPanelStatisticsSnapshot({
    panels,
    locations,
    audiences,
    sections,
    individualChoices: [
      {
        registrationId: "family",
        panelId: "panel",
        sectionId: "individual-section",
        choice: "yes",
        registrationStatus: "submitted",
        childrenCount: 2,
      },
      {
        registrationId: "cancelled-family",
        panelId: "panel",
        sectionId: "individual-section",
        choice: "yes",
        registrationStatus: "cancelled",
        childrenCount: 3,
      },
    ],
    schoolReservations: [
      {
        bookingId: "school-booking",
        panelId: "panel",
        sectionId: "school-section",
        reservationStatus: "reserved",
        bookingStatus: "confirmed",
        studentCount: 20,
        companionCount: 2,
      },
      {
        bookingId: "cancelled-school",
        panelId: "panel",
        sectionId: "school-section",
        reservationStatus: "reserved",
        bookingStatus: "cancelled",
        studentCount: 2,
        companionCount: 1,
      },
    ],
  });
  const panel = snapshot.panels[0];

  assert.ok(panel);
  assert.deepEqual(
    {
      capacity: panel.capacity,
      individualPeople: panel.individualPeople,
      inheritedChildren: panel.inheritedChildren,
      schoolBookings: panel.schoolBookings,
      schoolPeople: panel.schoolPeople,
      bookedPeople: panel.bookedPeople,
      remainingSeats: panel.remainingSeats,
      state: panel.state,
    },
    {
      capacity: 30,
      individualPeople: 1,
      inheritedChildren: 2,
      schoolBookings: 1,
      schoolPeople: 22,
      bookedPeople: 25,
      remainingSeats: 5,
      state: "available",
    }
  );
  assert.equal(panel.sections[0]?.bookedPeople, 3);
  assert.equal(panel.sections[1]?.bookedPeople, 22);
  assert.equal(snapshot.summary.bookedPeople, 25);
  assert.equal(snapshot.summary.schoolBookings, 1);
  assert.equal(snapshot.actualAttendanceAvailable, false);
  assert.equal(panel.actualPeople, null);
  assert.equal(panel.noShowPeople, null);
});

test("P10 flags full, nearly full and unconfigured panels while accepting unused capacity", () => {
  const statePanels: PanelStatisticsPanelInput[] = [
    ...["full", "near", "inconsistent", "zero"].map((id) => ({
      id,
      title: id,
      startsAt: "2026-10-25T08:00:00.000Z",
      endsAt: "2026-10-25T09:00:00.000Z",
      locationId: `${id}-location`,
      publicationStatus: "draft" as const,
    })),
    {
      id: "empty",
      title: "empty",
      startsAt: null,
      endsAt: null,
      locationId: null,
      publicationStatus: "draft",
    },
  ];
  const stateLocations: PanelStatisticsLocationInput[] = [
    { id: "full-location", name: "Full", maxCapacity: 10 },
    { id: "near-location", name: "Near", maxCapacity: 10 },
    { id: "inconsistent-location", name: "Mismatch", maxCapacity: 10 },
    { id: "zero-location", name: "Zero", maxCapacity: 10 },
  ];
  const stateSections: PanelStatisticsSectionInput[] = [
    { id: "full-section", panelId: "full", audienceTypeId: "school", capacity: 10 },
    { id: "near-section", panelId: "near", audienceTypeId: "school", capacity: 10 },
    { id: "bad-section", panelId: "inconsistent", audienceTypeId: "school", capacity: 8 },
    { id: "zero-section", panelId: "zero", audienceTypeId: "school", capacity: 0 },
  ];
  const snapshot = buildPanelStatisticsSnapshot({
    panels: statePanels,
    locations: stateLocations,
    audiences,
    sections: stateSections,
    individualChoices: [],
    schoolReservations: [
      {
        bookingId: "full-booking",
        panelId: "full",
        sectionId: "full-section",
        reservationStatus: "reserved",
        bookingStatus: "submitted",
        studentCount: 9,
        companionCount: 1,
      },
      {
        bookingId: "near-booking",
        panelId: "near",
        sectionId: "near-section",
        reservationStatus: "reserved",
        bookingStatus: "submitted",
        studentCount: 8,
        companionCount: 1,
      },
    ],
  });
  const stateById = new Map(
    snapshot.panels.map((panel) => [panel.id, panel.state])
  );

  assert.equal(stateById.get("full"), "full");
  assert.equal(stateById.get("near"), "nearly_full");
  assert.equal(stateById.get("empty"), "not_configured");
  assert.equal(stateById.get("zero"), "not_configured");
  assert.equal(stateById.get("inconsistent"), "available");
  assert.doesNotMatch(
    snapshot.panels.find((panel) => panel.id === "inconsistent")?.issues.join(" ") ?? "",
    /capienza della location/
  );
  assert.equal(
    snapshot.panels.find((panel) => panel.id === "zero")?.utilizationPercent,
    null
  );
});

test("P10 report exposes all requested filters and safe operational links", () => {
  for (const label of ["Giorno", "Location", "Panel", "Tipo pubblico"]) {
    assert.match(reportSource, new RegExp(`label=\\"${label}\\"`));
  }

  assert.match(reportSource, /panelView=panels/);
  assert.match(reportSource, /campaignPanel=/);
  assert.match(reportSource, /canManage && panel\.publicationStatus === "published"/);
  assert.match(reportSource, /Presenze effettive e no-show/);
  assert.match(reportSource, /Milestone\s+P11/);
  assert.match(statisticsSource, /moment_attendance_choices/);
  assert.match(statisticsSource, /school_panel_reservations/);
  assert.match(statisticsSource, /choice\.registrationStatus === "cancelled"/);
  assert.match(statisticsSource, /bookingStatus === "cancelled"/);
});
