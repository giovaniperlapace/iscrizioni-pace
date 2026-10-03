import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import ExcelJS from "exceljs";
import { NextRequest, NextResponse } from "next/server.js";
import { readServiceWorkbook, writeServiceTemplate, writeServiceReport } from "../lib/service-import/workbook.ts";
import { serviceImportSummary, type ServiceImportResultRow } from "../lib/service-import/format.ts";
import { loadAllRows } from "../lib/supabase/all-rows.ts";

async function workbook(rows: unknown[][], sheetName = "Servizi") {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet(sheetName);
  sheet.addRows([["nome", "cognome", "servizio"], ...rows]);
  return Buffer.from(await book.xlsx.writeBuffer());
}
test("service template has only three input columns and an active service catalog, no sample people to import", async () => {
  const buffer = await writeServiceTemplate([{ label: "Accoglienza" }]);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer as never);
  assert.deepEqual(book.getWorksheet("Servizi")!.getRow(1).values, [, "nome", "cognome", "servizio"]);
  assert.equal(book.getWorksheet("Servizi")!.rowCount, 1);
  assert.equal(book.getWorksheet("Catalogo servizi")!.getCell("A2").text, "Accoglienza");
  await assert.rejects(readServiceWorkbook(buffer), /vuoto/);
  book.getWorksheet("Servizi")!.addRow(["Anna", "Rossi", "Accoglienza"]);
  assert.equal((await readServiceWorkbook(Buffer.from(await book.xlsx.writeBuffer())))[0].error, "");
});
test("service parser preserves source row numbers and records invalid cells without dropping valid rows", async () => {
  const parsed = await readServiceWorkbook(await workbook([
    [" Anna ", "Rossi", "Accoglienza"], [], ["", "Rossi", "Accoglienza"],
    [123, "Bianchi", "Accoglienza"], ["x".repeat(161), "Verdi", "Servizio"],
  ]));
  assert.deepEqual(parsed.map((row) => row.row), [2, 4, 5, 6]);
  assert.equal(parsed[0].firstName, "Anna");
  assert.equal(parsed[0].error, "");
  assert.match(parsed[1].error, /nome: obbligatorio/);
  assert.match(parsed[2].error, /testo semplice/);
  assert.match(parsed[3].error, /160 caratteri/);
});
test("service parser rejects wrong templates, formulas, links, excessive rows and oversized files", async () => {
  await assert.rejects(readServiceWorkbook(await workbook([["Anna", "Rossi", "Accoglienza"]], "Partecipanti")), /modello servizi/);
  await assert.rejects(readServiceWorkbook(await workbook([[{ formula: '1+1' }, "Rossi", "Accoglienza"]])), /Formule/);
  await assert.rejects(readServiceWorkbook(await workbook([[{ text: "Anna", hyperlink: "https://example.test" }, "Rossi", "Accoglienza"]])), /collegamenti/);
  await assert.rejects(readServiceWorkbook(await workbook(Array.from({ length: 501 }, () => ["Anna", "Rossi", "Accoglienza"]))), /500 righe/);
  await assert.rejects(readServiceWorkbook(Buffer.alloc(2 * 1024 * 1024 + 1)), /2 MiB/);
  await assert.rejects(readServiceWorkbook(Buffer.from("not a zip")), /non valido/);
});
test("report totals reconcile and user strings remain literal Excel text", async () => {
  const statuses = ["updated", "unchanged", "not_found", "ambiguous", "invalid_service", "invalid_row", "conflict", "duplicate"] as const;
  const rows: ServiceImportResultRow[] = statuses.map((status, i) => ({ row: i + 2, firstName: "=1+1", lastName: "+Rossi", service: "@Servizio", error: "nome: obbligatorio", registrationId: null, status }));
  const counts = serviceImportSummary(rows);
  assert.equal(Object.values(counts).reduce((sum, n) => sum + n, 0), rows.length);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await writeServiceReport(rows) as never);
  const sheet = book.getWorksheet("Report")!;
  assert.equal(sheet.getCell("B2").type, ExcelJS.ValueType.String);
  assert.equal(sheet.getCell("B2").text, "=1+1");
  assert.equal(sheet.getCell("A5").value, 5);
  assert.match(sheet.getCell("F5").text, /Più iscrizioni/);
  assert.equal(book.getWorksheet("Riepilogo")!.getCell("B2").value, 8);
});

function harness(options: { denied?: boolean; rpcError?: string; catalogError?: boolean; reportError?: boolean } = {}) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const access: boolean[] = [];
  const paths: string[] = [];
  const queries: [number, number][] = [];
  const source = readFileSync("app/dashboard/participants/service-import/api/route.ts", "utf8");
  const ast = ts.createSourceFile("route.ts", source, ts.ScriptTarget.Latest, true);
  const stripped = ast.statements.filter((node) => !ts.isImportDeclaration(node)).map((node) => node.getText(ast).replace(/^export /, "")).join("\n");
  const code = ts.transpileModule(stripped, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const query = {
    select: () => query, eq: () => query, order: () => query,
    range: async (from: number, to: number) => {
      queries.push([from, to]);
      return options.catalogError ? { data: null, error: { message: "catalog failed" } } : {
        data: from === 0 ? Array.from({ length: 500 }, (_, i) => ({ id: String(i), label: `Servizio ${i}` })) : [{ id: "last", label: "Ultimo" }], error: null,
      };
    },
  };
  const deps = {
    NextResponse, Buffer, MAX_FILE_BYTES: 2 * 1024 * 1024, loadAllRows,
    readServiceWorkbook, writeServiceTemplate,
    writeServiceReport: options.reportError ? async () => { throw new Error("xlsx failed"); } : writeServiceReport,
    revalidatePath: (path: string) => paths.push(path),
    qualityAccess: async (write: boolean) => {
      access.push(write);
      if (options.denied) throw new Error("Non hai i permessi");
      return { auth: { user: { id: "session-actor" } }, event: { id: "current-event" }, db: { from: () => query } };
    },
    createSupabaseServiceClient: () => ({ rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return { data: { rows: (args.p_rows as ServiceImportResultRow[]).map((row) => ({ ...row, status: "updated", registrationId: "registration" })), replayed: false }, error: options.rpcError ? { code: options.rpcError } : null };
    } }),
  };
  const handlers = new Function(...Object.keys(deps), `${code};return {GET,POST};`)(...Object.values(deps)) as {
    GET: () => Promise<Response>; POST: (request: NextRequest) => Promise<Response>;
  };
  return { ...handlers, calls, access, paths, queries };
}
async function request(origin = "http://localhost:3127", id = "11111111-1111-4111-8111-111111111111") {
  const form = new FormData();
  form.set("file", new File([new Uint8Array(await workbook([["Anna", "Rossi", "Accoglienza"]]))], "services.xlsx"));
  form.set("importId", id);
  form.set("actor", "forged"); form.set("eventId", "other-event");
  return new NextRequest("http://localhost:3127/dashboard/participants/service-import/api", { method: "POST", body: form, headers: { origin } });
}
test("service API derives actor and event from session, calls only assignment RPC and returns downloadable report", async () => {
  const h = harness(); const response = await h.POST(await request());
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.ok(result.reportBase64);
  assert.equal(result.rows.length, 1);
  assert.equal(h.calls[0].name, "import_participant_services");
  assert.equal(h.calls[0].args.p_actor_user_id, "session-actor");
  assert.equal(h.calls[0].args.p_event_id, "current-event");
  assert.deepEqual(h.access, [true]);
  assert.equal(h.paths.length, 4);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});
test("service API blocks denied roles, foreign origins and invalid identifiers before assignment", async () => {
  const denied = harness({ denied: true });
  assert.equal((await denied.POST(await request())).status, 422);
  assert.equal((await denied.GET()).status, 400);
  assert.equal(denied.calls.length, 0); assert.equal(denied.queries.length, 0);
  const crossOrigin = harness();
  assert.equal((await crossOrigin.POST(await request("https://foreign.test"))).status, 403);
  assert.equal(crossOrigin.access.length, 0);
  const invalid = harness();
  assert.equal((await invalid.POST(await request(undefined, "bad"))).status, 422);
  assert.equal(invalid.calls.length, 0);
});
test("template paginates complete catalog and fails closed on query errors", async () => {
  const h = harness();
  const response = await h.GET();
  assert.equal(response.status, 200); assert.deepEqual(h.queries, [[0, 499], [500, 999]]);
  const book = new ExcelJS.Workbook(); await book.xlsx.load(Buffer.from(await response.arrayBuffer()) as never);
  assert.equal(book.getWorksheet("Catalogo servizi")!.getCell("A502").text, "Ultimo");
  assert.equal((await harness({ catalogError: true }).GET()).status, 400);
});
test("RPC failures never produce success; workbook generation failure preserves committed on-screen result", async () => {
  for (const code of ["42501", "PT409", "40P01"]) {
    const h = harness({ rpcError: code });
    assert.equal((await h.POST(await request())).status, 422);
    assert.equal(h.paths.length, 0);
  }
  const response = await harness({ reportError: true }).POST(await request());
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.rows[0].status, "updated"); assert.equal(result.reportBase64, null);
});
test("actual request body budget applies without trusting Content-Length", async () => {
  const h = harness();
  const response = await h.POST(new NextRequest("http://localhost:3127/dashboard/participants/service-import/api", {
    method: "POST", body: "x".repeat(2 * 1024 * 1024 + 64 * 1024 + 1), headers: { origin: "http://localhost:3127", "Content-Type": "multipart/form-data; boundary=test", "Content-Length": "10" },
  }));
  assert.equal(response.status, 422); assert.equal(h.calls.length, 0);
  assert.match((await response.json()).error, /2 MiB/);
});
