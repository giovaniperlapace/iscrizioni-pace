import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { distributionContext } from "../lib/ceremonies/distribution.server.ts";
const require = createRequire(import.meta.url);
const cache = new Map<string, any>();
function load(file: string): any {
  const path = resolve(file);
  if (cache.has(path)) return cache.get(path);
  const exports = {};
  cache.set(path, exports);
  const source = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "exports", source)((name: string) => {
    if (!name.startsWith("@/") && !name.startsWith(".")) return require(name);
    const base = name.startsWith("@/") ? resolve(name.slice(2)) : resolve(dirname(path), name);
    return load([base, base + ".tsx", base + ".ts"].find(existsSync)!);
  }, exports);
  return exports;
}
test("personal ceremonies keep two independent sections, including empty, child and failed reads in seven languages", () => {
  const { PersonalCeremonySeats } = load("app/dashboard/partecipante/cerimonie/seats.tsx");
  const seat = { id: "1", kind: "opening", name: "Adult", child: false, needsSeat: true, location: "Hall", sector: "A", startsAt: "2026-10-25T16:30:00+02:00", review: false };
  for (const locale of ["it", "en", "fr", "de", "es", "nl", "uk"]) {
    const render = (seats: unknown) => renderToStaticMarkup(createElement(PersonalCeremonySeats, { seats, locale }));
    const html = render([seat, { ...seat, id: "2", kind: "closing", name: "Child", child: true, needsSeat: false }]);
    assert.equal((html.match(/<section /g) ?? []).length, 2);
    assert.match(html, /Adult/); assert.match(html, /Child/);
    assert.equal((html.match(/>[^<]* A<\/p>/g) ?? []).length, 1);
    assert.doesNotMatch(render([]), /role="alert"/);
    assert.equal((render(null).match(/role="alert"/g) ?? []).length, 2);
  }
});
test("leader menu keeps ceremonies accessible when Forum bookings are closed", () => {
  const { LeaderSectionNavigation } = load("app/dashboard/capogruppo/section-navigation.tsx");
  const html = renderToStaticMarkup(createElement(LeaderSectionNavigation, { active: "ceremonies", locale: "it", showPanels: false }));
  assert.match(html, /href="\/dashboard\/capogruppo\/cerimonie"/);
  assert.doesNotMatch(html, /href="\/dashboard\/capogruppo\/panel"/);
  assert.match(html, /aria-current="page"/);
});
test("opened leader batch action still rejects missing membership before service access", async () => {
  const source = ts.transpileModule(readFileSync("app/dashboard/ceremony-leader-tickets-actions.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const db = { auth: { getUser: async () => ({ data: { user: { id: "actor" } } }) }, from(table: string) { const c = { select: () => c, eq: () => c, maybeSingle: async () => ({ data: { id: "event" } }), limit: async () => ({ data: [], error: null }) }; return c; } };
  const deps: Record<string, unknown> = {
    "next/cache": { revalidatePath() {} },
    "@/lib/supabase/server": { createSupabaseServerClient: async () => db },
    "@/lib/supabase/service": { createSupabaseServiceClient() { throw Error("Unauthorized service access"); } },
    "@/lib/ceremonies/leader-tickets.server": {},
    "@/lib/ceremonies/sector-desk": require("../lib/ceremonies/sector-desk.ts"),
    "@/lib/ceremonies/distribution.server": { distributionContext },
  };
  const exports: any = {};
  new Function("require", "exports", source)((name: string) => { assert.ok(name in deps, name); return deps[name]; }, exports);
  const id = "11111111-1111-4111-8111-111111111111";
  assert.deepEqual(await exports.saveLeaderSectorBatch({ allocationId: id, requestId: id, revision: 1, subjects: [{ registrationId: id, childId: null }] }), { status: "forbidden" });
});


test("renamed relay stays separate from the main hall with 500 places and its canonical label", () => {
  const { CeremonySectorMap } = load("app/dashboard/ceremony-sector-map.tsx");
  const { OpeningHallOverview } = load("app/dashboard/opening-hall-overview.tsx");
  const sectors = [
    { id: "main", name: "A", layoutCode: "A", capacity: 400, remaining: 110 },
    { id: "relay", name: "F: Sala Maschiella in collegamento", layoutCode: "F", capacity: 500, remaining: 489 },
  ];
  const desk = { sectors, active: null, allocations: [], nominees: [], claims: [], drafts: [] };
  const html = renderToStaticMarkup(createElement(CeremonySectorMap, { desk, onSelect: () => {} }));
  const sections = [...html.matchAll(/<section\b[^>]*>([\s\S]*?)<\/section>/g)];
  assert.equal(sections.length, 2);
  assert.doesNotMatch(sections[0][0], /Maschiella|data-sector="F"/);
  assert.match(sections[1][0], /Settore F: Sala Maschiella in collegamento/);
  assert.match(sections[1][0], /data-sector="F"/);
  assert.equal((sections[1][0].match(/<rect\b/g) ?? []).length, 500);
  assert.equal((html.match(/data-sector="F"/g) ?? []).length, 1);
  const overview = renderToStaticMarkup(createElement(OpeningHallOverview, { sectors, seats: [], claims: [], onBlock: () => {} }));
  assert.match(overview, /Settore F: Sala Maschiella in collegamento/);
  assert.doesNotMatch(overview, /Settore F · sala collegata/);
});
