import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { forumExportSession } from "../lib/panels/roster-export-sessions.ts";
import { writePanelRosterZip } from "../lib/panels/panel-roster-pdf.ts";
import type { PanelRoster } from "../lib/panels/panel-roster.server.ts";
import { mkdirSync, writeFileSync } from "node:fs";

test("Sessioni determinate dall’orario di Roma, anche vicino al cambio di giorno", () => {
  assert.equal(forumExportSession("2026-10-26T09:00:00Z"), "lunedi-mattina");
  assert.equal(forumExportSession("2026-10-26T11:00:00Z"), "lunedi-pomeriggio");
  assert.equal(forumExportSession("2026-10-26T23:30:00Z"), "martedi-mattina");
  assert.equal(forumExportSession("2026-10-27T14:00:00Z"), null);
  assert.equal(forumExportSession(null), null);
  assert.equal(forumExportSession("invalid"), null);
});

test("ZIP con un PDF distinto per Forum, elenchi lunghi e Forum vuoti", async () => {
  const people = Array.from({ length: 160 }, (_, i) => ({ id: String(i), firstName: "José André", lastName: `Rossi ${i}`, kind: "Iscritto" as const, accompanyingAdult: "", code: `TEST${i}`, groupName: "Comunità di Sant’Egidio - Roma centro" }));
  const roster: PanelRoster = { panelId: "test", title: "1. Dialogo, solidarietà e pace: un titolo lungo per verificare la stampa", people, waitlist: [{ ...people[0], status: "offered", expiresAt: "2026-10-26T10:30:00Z" }], schools: [{ id: "school", name: "Scuola di prova", city: "Roma", classDescription: "Classe III", students: 20, companions: 2 }], guests: [], individualSeats: 160, schoolSeats: 22, reservedGuestSeats: 0 };
  const data = await writePanelRosterZip([roster, { ...roster, people: [], waitlist: [], schools: [], individualSeats: 0, schoolSeats: 0 }], "Lunedì mattina");
  const zip = await JSZip.loadAsync(data);
  assert.equal(Object.keys(zip.files).length, 2);
  for (const file of Object.values(zip.files)) assert.equal((await file.async("nodebuffer")).subarray(0, 5).toString(), "%PDF-");
  mkdirSync("tmp/pdfs", { recursive: true });
  writeFileSync("tmp/pdfs/forum-synthetic.pdf", await Object.values(zip.files)[0].async("nodebuffer"));
});

test("Endpoint protegge evento e ruoli e non restituisce ZIP parziali", async () => {
  const { readFileSync } = await import("node:fs");
  const { default: ts } = await import("typescript");
  const { canViewPanelData } = await import("../lib/panels/management-access.ts");
  const { FORUM_EXPORT_SESSIONS } = await import("../lib/panels/roster-export-sessions.ts");
  const js = ts.transpileModule(readFileSync("app/dashboard/manager/esportazioni/forum/route.ts", "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  for (const scenario of ["anonymous", "foreign", "invalid", "stale", "empty", "failure", "success"]) {
    let reads = 0;
    let generated = false;
    const deps: Record<string, unknown> = {
      "@/lib/auth/session": { getCurrentAuthContext: async () => scenario === "anonymous" ? null : { eventRoles: [{ role: "manager", eventId: scenario === "foreign" ? "other" : "event" }] } },
      "@/lib/supabase/server": { createSupabaseServerClient: async () => ({}) },
      "@/lib/supabase/service": { createSupabaseServiceClient: () => { reads++; return {}; } },
      "@/lib/events/current": { getCurrentOperationalEvent: async () => ({ id: "event", title: "Evento" }) },
      "@/lib/panels/management-access": { canViewPanelData },
      "@/lib/supabase/all-rows": { loadAllRows: async () => ({ data: scenario === "empty" ? [] : [{ id: "a", title: "Forum 1", starts_at: "2026-10-26T09:00:00Z" }, { id: "b", title: "Forum 2", starts_at: "2026-10-27T09:00:00Z" }] }) },
      "@/lib/panels/forum-order": { sortForums: (rows: unknown) => rows },
      "@/lib/panels/roster-export-sessions": { FORUM_EXPORT_SESSIONS, forumExportSession },
      "@/lib/panels/panel-roster.server": { loadPanelRoster: async (_db: unknown, id: string) => { assert.equal(id, "a"); if (scenario === "failure") throw Error("Read failed"); return { panelId: id }; } },
      "@/lib/panels/panel-roster-pdf": { writePanelRosterZip: async (rows: unknown[]) => { generated = true; assert.equal(rows.length, 1); return Buffer.from("zip"); } },
    };
    const exports: { GET?: (r: Request) => Promise<Response> } = {};
    new Function("require", "exports", js)((name: string) => { assert.ok(name in deps); return deps[name]; }, exports);
    const response = await exports.GET!(new Request(`https://example.invalid/?event=${scenario === "stale" ? "old" : "event"}&session=${scenario === "invalid" ? "bad" : "lunedi-mattina"}`));
    assert.equal(response.status, { anonymous: 401, foreign: 403, invalid: 400, stale: 409, empty: 404, failure: 500, success: 200 }[scenario]);
    assert.equal(generated, scenario === "success");
    assert.equal(reads, ["empty", "failure", "success"].includes(scenario) ? 1 : 0);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  }
});
