import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";
import { inheritGroupTerritories } from "../lib/groups/territory.ts";
import { findMatchingGroupCandidates, type GroupMatchCandidate } from "../lib/groups/matching.ts";
import { loadAllRows } from "../lib/supabase/all-rows.ts";

function group(id: string, changes: Partial<GroupMatchCandidate> = {}): GroupMatchCandidate {
  return { id, name: id, publicLabel: null, primaryLeaderName: null, countryId: null,
    cityId: null, parentGroupId: null, nodeType: "group", communityKind: "santegidio",
    ageBands: [], isAssignable: true, isPublicCatalog: true, publicOrder: 100, ...changes };
}
const country = group("poland", { nodeType: "country", countryId: "PL", communityKind: "territorial", isPublicCatalog: false, isAssignable: false });
const criteria = { countryId: "PL", cityId: "poznan", birthDate: "1973-01-21", eventStartsOn: "2026-10-25" };
const suggest = (groups: GroupMatchCandidate[]) => findMatchingGroupCandidates(inheritGroupTerritories(groups), criteria, { publicOnly: true });

test("Poland children inherit country from a hidden, non-assignable parent without mutation", () => {
  const children = [group("Varsavia", { parentGroupId: country.id }), group("Poznan Chojna", { parentGroupId: country.id })];
  assert.deepEqual(suggest([country, ...children]).map(g => g.name), ["Poznan Chojna", "Varsavia"]);
  assert.equal(suggest([country, ...children])[0].countryId, "PL");
  assert.equal(children[0].countryId, null);
});

test("closest city wins over national groups regardless of public order, through multiple ancestors", () => {
  const city = group("city", { parentGroupId: country.id, cityId: "poznan", nodeType: "city", isPublicCatalog: false });
  const area = group("area", { parentGroupId: city.id, nodeType: "area", isPublicCatalog: false });
  const groups = [country, city, area,
    group("national", { parentGroupId: country.id, publicOrder: 0 }),
    group("local", { parentGroupId: area.id, publicOrder: 999 }),
    group("other-city", { parentGroupId: country.id, cityId: "warsaw" }),
    group("hidden", { parentGroupId: area.id, isPublicCatalog: false }),
    group("unassignable", { parentGroupId: area.id, isAssignable: false }),
    group("young", { parentGroupId: area.id, ageBands: ["giovani"] }),
    group("foreign", { countryId: "IT" }),
  ];
  assert.deepEqual(suggest(groups).map(g => g.id), ["local", "national"]);
  assert.equal(inheritGroupTerritories(groups).find(g => g.id === "local")?.cityId, "poznan");
});

test("explicit city takes precedence and unknown city falls back to country", () => {
  const city = group("city", { parentGroupId: country.id, cityId: "warsaw", nodeType: "city", isPublicCatalog: false });
  const rows = inheritGroupTerritories([country, city, group("local", { parentGroupId: city.id, cityId: "poznan" })]);
  assert.equal(rows[2].cityId, "poznan");
  assert.deepEqual(findMatchingGroupCandidates(rows, { ...criteria, cityId: null }, { publicOnly: true }).map(g => g.id), ["local"]);
});

test("incomplete, cyclic and conflicting hierarchies fail instead of inventing geography", () => {
  assert.throws(() => inheritGroupTerritories([group("missing", { parentGroupId: "absent" })]), /Incomplete/);
  assert.throws(() => inheritGroupTerritories([group("a", { parentGroupId: "b" }), group("b", { parentGroupId: "a" })]), /Cyclic/);
  assert.throws(() => inheritGroupTerritories([country, group("conflict", { parentGroupId: country.id, countryId: "IT" })]), /Conflicting/);
});

const source = readFileSync(new URL("../lib/registrations/public-flow.ts", import.meta.url), "utf8");
function loadFunction(name: string, deps: Record<string, unknown>) {
  const ast = ts.createSourceFile("public-flow.ts", source, ts.ScriptTarget.Latest, true);
  const fn = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name);
  assert.ok(fn);
  const js = ts.transpileModule(fn.getText(ast).replace(/^export /, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(deps), `${js}; return ${name}`)(...Object.values(deps));
}
const mapGroupRow = loadFunction("mapGroupRow", Object.fromEntries(["parseNodeType", "parseCommunityKind", "parseAgeBands"].map(name => [name, loadFunction(name, {})])));
const getEventGroupCandidates = loadFunction("getEventGroupCandidates", { loadAllRows, mapGroupRow });
const getOptions = loadFunction("getPublicRegistrationOptions", {
  getCurrentPublicEvent: async () => ({ id: "event" }), resolveActiveGroupRegistrationLink: async () => null,
  getEventGroupCandidates, inheritGroupTerritories, loadAllRows,
});
function database(fail = false, cityChoices = false) {
  const calls: URL[] = [];
  const rows = Array.from({ length: 1001 }, (_, i) => ({
    id: String(i), name: `group-${i}`, node_type: i === 1000 ? "country" : "group",
    parent_group_id: i === 1000 ? null : "1000", country_id: i === 1000 ? "PL" : null,
    city_id: null, is_public_catalog: i !== 1000, is_assignable: i !== 1000,
    community_kind: i === 1000 ? "territorial" : "santegidio", age_brackets: [],
  }));
  if (cityChoices) {
    for (let i = 0; i < 4; i++) rows[i].node_type = "city";
    rows[1].is_public_catalog = false;
    rows[2].is_assignable = false;
    rows[3].is_public_catalog = false;
    rows[3].is_assignable = false;
  }
  const db = createClient("https://db.example.test", "synthetic", { auth: { persistSession: false }, global: { fetch: async (input, init) => {
    assert.equal(init?.method ?? "GET", "GET");
    const url = new URL(String(input));
    if (!url.pathname.endsWith("/groups")) return Response.json([]);
    calls.push(url);
    assert.equal(url.searchParams.get("event_id"), "eq.event");
    assert.equal(url.searchParams.get("is_active"), "eq.true");
    assert.equal(url.searchParams.get("is_public_catalog"), null);
    assert.equal(url.searchParams.get("order"), "id.asc");
    const offset = Number(url.searchParams.get("offset"));
    if (fail && offset >= 500) return Response.json({ message: "read failed" }, { status: 400 });
    return Response.json(rows.slice(offset, offset + Number(url.searchParams.get("limit"))));
  } } });
  return { db, calls };
}
test("public loader pages all active event ancestors and sends only resolved public choices", async () => {
  const { db, calls } = database();
  const options = await getOptions(db);
  assert.equal(calls.length, 3);
  assert.equal(options.groups.length, 1000);
  assert.ok(options.groups.every((g: GroupMatchCandidate) => g.countryId === "PL" && g.nodeType === "group"));
  assert.equal(findMatchingGroupCandidates(options.groups, criteria, { publicOnly: true }).length, 1000);
});
test("a later page error never becomes partial or empty suggestions", async () => {
  await assert.rejects(getOptions(database(true).db), /read failed/);
});

test("public loader exposes cities only when both public and assignable", async () => {
  const { db } = database(false, true);
  const options = await getOptions(db);
  const cities = options.groups.filter((g: GroupMatchCandidate) => g.nodeType === "city");
  assert.deepEqual(cities.map((g: GroupMatchCandidate) => g.id), ["0"]);
  const matches = findMatchingGroupCandidates(options.groups, criteria, { publicOnly: true });
  assert.ok(matches.some(g => g.id === "0"));
  for (const id of ["1", "2", "3"]) assert.ok(!matches.some(g => g.id === id));
});
