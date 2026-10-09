import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { canAccessPanelManagement, isPanelCampaign } from "../lib/panels/management-access.ts";

function loadFunction(name: string, dependencies: Record<string, unknown>) {
  const source = readFileSync(new URL("../app/api/email-campaigns/route.ts", import.meta.url), "utf8");
  const ast = ts.createSourceFile("route.ts", source, ts.ScriptTarget.Latest, true);
  const node = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name)!;
  const js = ts.transpileModule(node.getText(ast).replace("export ", ""), {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS}}).outputText;
  return new Function(...Object.keys(dependencies), `${js}; return ${name};`)(...Object.values(dependencies));
}

test("panel acceptance keeps cumulative admin access and excludes manager/viewer", () => {
  assert.equal(canAccessPanelManagement([]), false);
  for (const role of ["manager", "manager_viewer", "capogruppo", "accoglienza"] as const) {
    assert.equal(canAccessPanelManagement([{role, eventId: "event"}]), false);
    assert.equal(canAccessPanelManagement([{role, eventId: "event"}, {role: "admin", eventId: null}]), true);
  }
});

test("manager cannot request panel or school email audiences through a forged API payload", async () => {
  const post = loadFunction("POST", {
    canAccessPanelManagement, isPanelCampaign,
    requireCampaignManager: async () => ({eventRoles: [{role: "manager", eventId: "event"}]}),
    error: (message: string, status: number) => ({message, status}),
    previewRecipients: () => {throw new Error("unexpected service-role loader");},
    publicCampaignError: (error: unknown) => {throw error;},
  });
  for (const filters of [{audience: "teachers"}, {panelId: "panel"}, {schoolName: "School"}, {subject: "{{panel}}"}, {message: "{{ scuola }}"}]) {
    for (const action of ["recipients", "preview", "test", "send"]) {
      const result = await post(new Request("https://example.invalid/api/email-campaigns", {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({action, ...filters})}));
      assert.equal(result.status, 403);
    }
  }
});

test("manager cannot test/send an admin panel campaign by reusing its ID", async () => {
  for (const filters of [{audience: "teachers"}, {panelId: "panel"}, {schoolName: "School"}]) {
    const query = {select: () => query, eq: () => query, maybeSingle: async () => ({data: {status: "ready", event_id: "event", filters_snapshot: filters, subject_template: "Subject", body_template: "Body"}})};
    const deliver = loadFunction("deliverCampaign", {
      canAccessPanelManagement, isPanelCampaign,
      createSupabaseServiceClient: () => ({from: (table: string) => { assert.equal(table,"email_campaigns"); return query; }}),
      assertCanManageCampaignEvent: () => {},
      error: (message: string, status: number) => ({message,status}),
    });
    for (const action of ["test", "send"]) assert.equal((await deliver("manager", "synthetic@example.invalid", [{role: "manager", eventId: "event"}], "campaign", action)).status, 403);
  }
});
