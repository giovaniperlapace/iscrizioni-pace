import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { groupLeaderSummaries } from "../lib/groups/leader-summary.ts";

function user(id: string, name: string | null, primary: boolean, group = "group", event = "event") {
  return { userId: id, fullName: name, email: `${id}@example.org`, assignments: [{ role: "capogruppo", groupId: group, eventId: event, isPrimaryGroupLeader: primary }] };
}
const users = [user("1", "Anna Rossi", true), user("2", "Bruno De Luca", true), user("3", "Carla Bianchi", false)];

test("all primary and secondary leaders are retained with exact group/event scope", () => {
  const leaders = groupLeaderSummaries([...users, user("other", "Other", true, "another"), user("event2", "Other event", true, "group", "another")], "group", "event");
  assert.deepEqual(leaders.map(({ name, isPrimary }) => [name, isPrimary]), [["Anna Rossi", true], ["Bruno De Luca", true], ["Carla Bianchi", false]]);
});

test("deduplicate by account, preserve namesakes, ignore unrelated operational roles", () => {
  const manager = user("manager", "Manager", true); manager.assignments[0].role = "manager";
  const leaders = groupLeaderSummaries([users[0], users[0], user("4", "Anna Rossi", false), manager], "group", "event");
  assert.equal(leaders.length, 2);
  assert.deepEqual(leaders.map(({ isPrimary }) => isPrimary), [true, false]);
});

test("missing names use email and secondary-only groups remain secondary", () => {
  assert.deepEqual(groupLeaderSummaries([user("secondary", null, false)], "group", "event"), [{ userId: "secondary", name: "secondary@example.org", isPrimary: false }]);
});

const source = readFileSync(new URL("../app/dashboard/group-leaders-summary.tsx", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
const exports: Record<string, unknown> = {};
new Function("React", "exports", js)(React, exports);
const Component = exports.GroupLeadersSummary as React.ComponentType<{ leaders: ReturnType<typeof groupLeaderSummaries>; legacyName: string | null }>;
const render = (leaders: ReturnType<typeof groupLeaderSummaries>, legacyName: string | null = null) => renderToStaticMarkup(React.createElement(Component, { leaders, legacyName }));

test("compact component renders every name and distinguishes primary/secondary", () => {
  const html = render(groupLeaderSummaries(users, "group", "event"), "Stale name");
  for (const name of ["Anna Rossi", "Bruno De Luca", "Carla Bianchi", "Principali:", "Secondario:"]) assert.ok(html.includes(name));
  assert.ok(!html.includes("Stale name"));
  assert.ok(!html.includes("truncate"));
});

test("legacy name is only a fallback without memberships; empty groups show unassigned", () => {
  assert.match(render([], "Legacy Name"), /Legacy Name/);
  assert.match(render([]), /Da assegnare/);
  const html = render(groupLeaderSummaries([users[2]], "group", "event"), "Legacy Name");
  assert.match(html, /Secondario:/);
  assert.ok(!html.includes("Principale:"));
  assert.ok(!html.includes("Legacy Name"));
});
