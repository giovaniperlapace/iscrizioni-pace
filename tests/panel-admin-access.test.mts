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

test("panel management allows event managers, cumulative admin and excludes viewer", () => {
  assert.equal(canAccessPanelManagement([]), false);
  assert.equal(canAccessPanelManagement([{role: "admin", eventId: "other"}], "event"), false);
  assert.equal(canAccessPanelManagement([{role: "manager", eventId: "event"}], "event"), true);
  assert.equal(canAccessPanelManagement([{role: "manager", eventId: "other"}], "event"), false);
  assert.equal(canAccessPanelManagement([{role: "manager", eventId: null}]), false);
  assert.equal(canAccessPanelManagement([{role: "manager", eventId: "other"}, {role: "manager_viewer", eventId: "event"}], "event"), false);
  for (const role of ["manager_viewer", "capogruppo", "accoglienza"] as const) {
    assert.equal(canAccessPanelManagement([{role, eventId: "event"}]), false);
    assert.equal(canAccessPanelManagement([{role, eventId: "event"}, {role: "admin", eventId: null}]), true);
  }
});

test("viewer cannot request panel or school email audiences through a forged API payload", async () => {
  const post = loadFunction("POST", {
    canAccessPanelManagement, isPanelCampaign,
    requireCampaignManager: async () => ({eventRoles: [{role: "manager_viewer", eventId: "event"}]}),
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

test("foreign manager cannot test/send an admin panel campaign by reusing its ID", async () => {
  for (const filters of [{audience: "teachers"}, {panelId: "panel"}, {schoolName: "School"}]) {
    const query = {select: () => query, eq: () => query, maybeSingle: async () => ({data: {status: "ready", event_id: "event", filters_snapshot: filters, subject_template: "Subject", body_template: "Body"}})};
    const deliver = loadFunction("deliverCampaign", {
      canAccessPanelManagement, isPanelCampaign,
      createSupabaseServiceClient: () => ({from: (table: string) => { assert.equal(table,"email_campaigns"); return query; }}),
      assertCanManageCampaignEvent: () => {},
      error: (message: string, status: number) => ({message,status}),
    });
    for (const action of ["test", "send"]) assert.equal((await deliver("manager", "synthetic@example.invalid", [{role: "manager", eventId: "other"}], "campaign", action)).status, 403);
  }
});


test("current-event manager can load panel/school campaign recipients without delivery", async () => {
  const calls: unknown[] = [];
  const assertCanManageCampaignEvent = loadFunction("assertCanManageCampaignEvent", {});
  const preview = loadFunction("previewRecipients", {
    canAccessPanelManagement,
    createSupabaseServiceClient: () => ({}),
    getCurrentOperationalEvent: async () => ({id: "event"}),
    assertCanManageCampaignEvent,
    campaignFilters: (body: unknown) => body,
    resolveCampaignRecipients: async (eventId: string, filters: unknown) => {calls.push({eventId, filters}); return [{recipientKey: "teacher:synthetic"}];},
    loadCampaignRecipientPreviews: async (_recipients: unknown, _selection: unknown, eventId: string, allow: boolean) => {assert.equal(eventId, "event"); assert.equal(allow, true); return [];},
    recipientSelectionSummary: () => ({}),
    NextResponse: {json: (value: unknown) => value},
  });
  for (const filters of [{audience: "teachers"}, {audience: "participants", panelId: "panel"}]) {
    await preview([{role: "manager", eventId: "event"}], filters);
  }
  assert.equal(calls.length, 2);
  await assert.rejects(preview([{role: "manager", eventId: "other"}], {audience: "teachers"}));
  assert.equal(calls.length, 2);
});


test("panel action guard authorizes the resolved current event before mutations", async () => {
  const source = readFileSync("lib/panels/release.server.ts", "utf8");
  const js = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS}}).outputText;
  for (const roles of [
    [{role: "manager", eventId: "event"}],
    [{role: "admin", eventId: null}],
    [{role: "manager", eventId: "other"}],
    [{role: "manager_viewer", eventId: "event"}],
    [{role: "manager", eventId: "other"}, {role: "manager_viewer", eventId: "event"}],
  ]) {
    const reads: string[] = [];
    const deps: Record<string, unknown> = {
      "next/navigation": {redirect: (url: string) => {throw new Error(`Redirect:${url}`);}},
      "@/lib/supabase/server": {createSupabaseServerClient: async () => ({})},
      "./release": {},
      "@/lib/auth/session": {getCurrentAuthContext: async () => ({eventRoles: roles, dashboardPath: "/dashboard/manager"})},
      "./management-access": {canAccessPanelManagement},
      "@/lib/supabase/service": {createSupabaseServiceClient: () => ({})},
      "@/lib/events/current": {getCurrentOperationalEvent: async () => {reads.push("current-event"); return {id: "event"};}},
    };
    const exports: {requirePanelManager?: () => Promise<void>} = {};
    new Function("require", "exports", js)((name: string) => {assert.ok(name in deps, name); return deps[name];}, exports);
    if (roles.some(role => role.role === "admin" || role.role === "manager" && role.eventId === "event")) {
      await exports.requirePanelManager!();
    } else {
      await assert.rejects(exports.requirePanelManager!(), /Redirect:/);
    }
    assert.deepEqual(reads, roles.every(role => role.role === "manager_viewer") ? [] : ["current-event"]);
  }
});


test("manager of a past event cannot deliver its panel campaign or read recipients", async () => {
  const query = {select: () => query, eq: () => query, maybeSingle: async () => ({data: {status: "ready", event_id: "past", filters_snapshot: {audience: "teachers"}, subject_template: "Subject", body_template: "Body"}})};
  const deliver = loadFunction("deliverCampaign", {
    canAccessPanelManagement, isPanelCampaign,
    createSupabaseServiceClient: () => ({from: (table: string) => {assert.equal(table, "email_campaigns"); return query;}}),
    assertCanManageCampaignEvent: loadFunction("assertCanManageCampaignEvent", {}),
    getCurrentOperationalEvent: async () => ({id: "current"}),
    error: (message: string, status: number) => ({message, status}),
  });
  for (const action of ["test", "send"]) {
    const result = await deliver("manager", "synthetic@example.invalid", [{role: "manager", eventId: "past"}], "campaign", action);
    assert.equal(result.status, 403);
  }
});
