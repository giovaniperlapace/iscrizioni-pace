import assert from "node:assert/strict";
import test from "node:test";
import { buildEventStatisticsSnapshot, buildAssignedGroupTree, filterStatisticsPeople, parseStatisticsDrilldown, serializeStatisticsDrilldown, type StatisticsGroup } from "../lib/registrations/event-statistics.ts";

const groups: StatisticsGroup[] = [
  { id: "it", name: "Italia", nodeType: "country", parentGroupId: null },
  { id: "roma", name: "Roma", nodeType: "city", parentGroupId: "it" },
  { id: "area", name: "Centro", nodeType: "area", parentGroupId: "roma" },
  { id: "a", name: "Omonimo", nodeType: "group", parentGroupId: "area" },
  { id: "b", name: "Omonimo", nodeType: "group", parentGroupId: "roma" },
  { id: "empty", name: "Vuoto", nodeType: "group", parentGroupId: "it" },
  { id: "standalone", name: "Autonomo", nodeType: "group", parentGroupId: null },
].map(g => ({ ...g, eventId: "event", isAssignable: g.nodeType === "group" }));
function snapshot(catalogue = groups) {
  return buildEventStatisticsSnapshot({
    groups: catalogue,
    participants: ["roma", "a", "b", "standalone", null].map((id, i) => ({
      registrationId: `r${i}`, eventId: "event", eventTitle: "Evento", currentGroupId: id, currentGroupName: id,
      country: "Francia", city: "Parigi", childrenCount: i === 1 ? 2 : 0,
    })),
    attendanceChoices: [{ registration_id: "r1", day: "2026-10-25", day_part: "morning", choice: "yes" }],
  });
}
test("hierarchy preserves real ancestors, direct registrations, namesakes, children and exact drilldowns", () => {
  const data = snapshot();
  const roots = buildAssignedGroupTree(data.people);
  assert.equal(roots.length, 3);
  assert.equal(roots.reduce((n, r) => n + r.people.length, 0), 7);
  const italy = roots.find(r => r.label === "Italia")!;
  assert.equal(italy.people.length, 5);
  assert.equal(italy.children.length, 1);
  const rome = italy.children[0];
  assert.equal(rome.label, "Roma");
  assert.equal(rome.children[0].label, "Iscritti a Roma senza sottogruppo");
  assert.equal(rome.children[0].people.length, 1);
  assert.equal(rome.children[1].children[0].people.length, 3);
  const walk = (rows: typeof roots) => {
    for (const row of rows) {
      const filter = parseStatisticsDrilldown(serializeStatisticsDrilldown(row.filter))!;
      assert.deepEqual(filterStatisticsPeople(data.people, filter), row.people);
      assert.equal(filterStatisticsPeople(data.people, { ...filter, attendanceSlot: "2026-10-25__morning" }).length, row.people.filter(p => p.registrationId === "r1").length);
      if (row.children.length) assert.equal(row.children.reduce((n, child) => n + child.people.length, 0), row.people.length);
      assert.notEqual(row.label, "Vuoto");
      walk(row.children);
    }
  };
  walk(roots);
  assert.deepEqual(buildAssignedGroupTree([]), []);
});
for (const [name, catalogue] of [
  ["cycle", groups.map(g => g.id === "it" ? { ...g, parentGroupId: "a" } : g)],
  ["missing parent", groups.filter(g => g.id !== "it")],
  ["cross-event parent", groups.map(g => g.id === "it" ? { ...g, eventId: "other" } : g)],
] as const) {
  test(`hierarchy rejects ${name}`, () => assert.throws(() => snapshot(catalogue), /statistics group hierarchy/));
}
