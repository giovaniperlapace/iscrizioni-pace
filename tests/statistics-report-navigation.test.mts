import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as React from "react";
import * as runtime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as statistics from "../lib/registrations/event-statistics.ts";
import * as reports from "../lib/registrations/statistics-reports.ts";

const js = ts.transpileModule(readFileSync(new URL("../app/dashboard/statistics-section.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const exports: { StatisticsSection?: React.ComponentType<Record<string, unknown>> } = {};
new Function("require", "exports", js)((name: string) => {
  if (name === "react") return React;
  if (name === "react/jsx-runtime") return runtime;
  if (name === "lucide-react") return { Baby: "svg", ChevronRight: "svg", ChevronDown: "svg", UserRound: "svg", Users: "svg" };
  if (name.endsWith("disability-statistics-report")) return { DisabilityStatisticsReport: () => React.createElement("div", null, "Protected report") };
  if (name.endsWith("statistics-reports")) return reports;
  if (name.endsWith("event-statistics")) return statistics;
  if (name.endsWith("pending-link")) return { default: ({ prefetch, scroll, ...props }: Record<string, unknown>) => {
    assert.equal(prefetch === false || prefetch === undefined, true);
    void scroll;
    return React.createElement("a", props);
  } };
  throw Error(name);
}, exports);

test("one report at a time, default/fallback to first, role and menu preserved in category links", () => {
  const snapshot = statistics.buildEventStatisticsSnapshot({ participants: [], groups: [], attendanceChoices: [] });
  for (const dashboard of ["admin", "manager"]) for (const navMode of ["full", "mini"]) {
    for (const value of [undefined, "invalid", ...reports.STATISTICS_REPORTS.map(r => r.key)]) {
      const report = reports.resolveStatisticsReport(value);
      const html = renderToStaticMarkup(React.createElement(exports.StatisticsSection!, { statistics: snapshot, dashboard, navMode, report, canViewDisability: true, disabilityStatistics: { people: [] } }));
      assert.deepEqual([...html.matchAll(/data-statistics-report="([^"]+)"/g)].map(m => m[1]), [report]);
      assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
      for (const category of reports.STATISTICS_REPORTS) {
        assert.ok(html.includes(`/dashboard/${dashboard}?section=dashboard&amp;nav=${navMode}&amp;report=${category.key}`));
      }
    }
  }
  assert.equal(reports.resolveStatisticsReport(undefined), "territory");
  assert.equal(reports.resolveStatisticsReport("invalid"), "territory");
});


test("unscoped users do not render disability category or report, even with injected props", () => {
  const snapshot = statistics.buildEventStatisticsSnapshot({ participants: [], groups: [], attendanceChoices: [] });
  const html = renderToStaticMarkup(React.createElement(exports.StatisticsSection!, { statistics: snapshot, dashboard: "manager", navMode: "mini", report: "disability", canViewDisability: false, disabilityStatistics: { people: [] } }));
  assert.doesNotMatch(html, /report=disability|Protected report|data-statistics-report="disability"/);
});
