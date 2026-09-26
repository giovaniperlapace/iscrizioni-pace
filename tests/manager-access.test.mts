import { parseStatisticsDrilldown } from "../lib/registrations/event-statistics.ts";
import { resolveStatisticsReport } from "../lib/registrations/statistics-reports.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";

const source = readFileSync(new URL("../app/dashboard/manager/page.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("page.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const helpers = ["getManagerEventScope", "resolveManagerSection", "canAccessManagerSection", "ManagerSidebar"];
const functions = ast.statements.filter(node => ts.isFunctionDeclaration(node) && helpers.includes(node.name?.text ?? "")).map(node => node.getText(ast)).join("\n");
const page = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "ManagerDashboardPage")!.getText(ast);
// Execute the production entry point through the authorization boundary. A
// sentinel replaces the loaders so a denied URL must never reach them.
const boundary = page.slice(0, page.indexOf("  const managerOperations =")) + ' return {canManage, activeSection}; }';
const js = ts.transpileModule(functions + "\n" + boundary.replace("export default ", ""), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function fixture(roles: Array<{ role: string; eventId: string | null }>, currentEventId: string | null = "current") {
  const reads: string[] = [];
  const deps = {
    exports: {},
    resolveStatisticsReport, parseStatisticsDrilldown,
    require: (name: string) => { assert.equal(name, "react/jsx-runtime"); return jsxRuntime; },
    createSupabaseServerClient: async () => ({}),
    createSupabaseServiceClient: () => ({ from: () => { throw new Error("Unexpected operational read"); } }),
    getCurrentAuthContext: async () => ({ user: { id: "self" }, eventRoles: roles }),
    getCurrentOperationalEvent: async () => { reads.push("current-event"); return currentEventId ? { id: currentEventId } : null; },
    parseOperationsDashboardFilters: () => ({}),
    redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); },
    permanentRedirect: (url: string) => { throw new Error(`PERMANENT:${url}`); },
    Link: "a", BarChart3: "svg", Users: "svg", Mail: "svg", ShieldCheck: "svg", Network: "svg", Settings: "svg",
  };
  const api = new Function(...Object.keys(deps), `${js}; return {ManagerDashboardPage, ManagerSidebar};`)(...Object.values(deps));
  return { ...api, reads };
}

const deniedParams = [
  ...["email", "ruoli", "gruppi", "impostazioni", "servizi"].map(section => ({ section })),
  { section: "dashboard", report: "disability" },
  { section: "iscritti", stat: "difficulty=hearing" },
  { groupTool: "links" }, { groupId: "group" }, { groupLinkToken: "secret" },
  { roleSaved: "1" }, { serviceId: "service" },
];
for (const params of deniedParams) {
  test(`viewer cannot open excluded section ${JSON.stringify(params)}`, async () => {
    const f = fixture([{ role: "manager_viewer", eventId: "current" }]);
    await assert.rejects(f.ManagerDashboardPage({ searchParams: Promise.resolve(params) }), /^Error: REDIRECT:\/dashboard\/manager\?section=dashboard&nav=mini$/);
    assert.deepEqual(f.reads, ["current-event"]);
  });
}

test("viewer can open statistics and participant data in read-only mode", async () => {
  const f = fixture([{ role: "manager_viewer", eventId: "current" }]);
  for (const section of ["dashboard", "iscritti"]) {
    assert.deepEqual(await f.ManagerDashboardPage({ searchParams: Promise.resolve({ section }) }), { canManage: false, activeSection: section });
  }
});

test("manager rights belong to the current event and global admin remains unrestricted", async () => {
  for (const roles of [
    [{ role: "manager", eventId: "current" }],
    [{ role: "admin", eventId: null }],
    [{ role: "manager", eventId: "current" }, { role: "manager_viewer", eventId: "current" }],
  ]) {
    const f = fixture(roles);
    for (const section of ["dashboard", "iscritti", "email", "ruoli", "gruppi", "impostazioni"]) {
      assert.deepEqual(await f.ManagerDashboardPage({ searchParams: Promise.resolve({ section }) }), { canManage: true, activeSection: section });
    }
  }
  for (const roles of [
    [{ role: "manager", eventId: "other" }, { role: "manager_viewer", eventId: "current" }],
    [{ role: "admin", eventId: "other" }, { role: "manager_viewer", eventId: "current" }],
  ]) {
    await assert.rejects(fixture(roles).ManagerDashboardPage({ searchParams: Promise.resolve({ section: "ruoli" }) }), /REDIRECT:/);
  }
});

test("both sidebar modes render exactly the two allowed viewer menu items", () => {
  const f = fixture([]);
  for (const navMode of ["mini", "full"]) {
    for (const canManage of [false, true]) {
      const html = renderToStaticMarkup(f.ManagerSidebar({ activeSection: "dashboard", navMode, canManage, report: "territory" }));
      const menu = html.slice(html.indexOf("<nav"));
      const sections = [...menu.matchAll(/href="\/dashboard\/manager\?section=([a-z]+)&amp;nav=mini"/g)].map(match => match[1]);
      assert.deepEqual(sections, canManage ? ["dashboard", "iscritti", "email", "ruoli", "gruppi", "impostazioni"] : ["dashboard", "iscritti"]);
    }
  }
});
