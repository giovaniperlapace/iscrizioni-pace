import ExcelJS from "exceljs";
import { inspectArchive } from "../data-quality/workbook.ts";
import { MAX_IMPORT_ROWS } from "../data-quality/format.ts";
import {
  SERVICE_IMPORT_COLUMNS, SERVICE_IMPORT_STATUS, serviceImportDetail,
  serviceImportSummary, type ServiceImportRow, type ServiceImportResultRow,
} from "./format.ts";

export async function readServiceWorkbook(buffer: Buffer): Promise<ServiceImportRow[]> {
  await inspectArchive(buffer);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer as unknown as Parameters<typeof book.xlsx.load>[0]);
  const sheet = book.getWorksheet("Servizi");
  if (!sheet || sheet.columnCount !== 3 ||
    SERVICE_IMPORT_COLUMNS.some((column, index) => sheet.getRow(1).getCell(index + 1).value !== column) ||
    book.worksheets.some((item) => !["Servizi", "Istruzioni", "Catalogo servizi"].includes(item.name))) {
    throw new Error("Usa il modello servizi: foglio Servizi e colonne nome, cognome, servizio.");
  }
  if (sheet.rowCount > MAX_IMPORT_ROWS + 1) throw new Error("Il file supera 500 righe. Dividilo in più file.");
  const rows: ServiceImportRow[] = [];
  sheet.eachRow((row, index) => {
    if (index === 1) return;
    const errors: string[] = [];
    const values = SERVICE_IMPORT_COLUMNS.map((column, i) => {
      const cell = row.getCell(i + 1);
      if (cell.value !== null && typeof cell.value !== "string") errors.push(`${column}: usa testo semplice`);
      const value = cell.text.trim();
      if (!value) errors.push(`${column}: obbligatorio`);
      if (value.length > 160) errors.push(`${column}: massimo 160 caratteri`);
      return value.slice(0, 200);
    });
    if (values.every((value) => !value)) return;
    rows.push({ row: index, firstName: values[0], lastName: values[1], service: values[2], error: errors.join("; ") });
  });
  if (!rows.length) throw new Error("Il foglio Servizi è vuoto.");
  return rows;
}

function sheetWithRows(book: ExcelJS.Workbook, name: string, headers: string[], rows: (string | number)[][], widths: number[]) {
  const sheet = book.addWorksheet(name);
  sheet.addRow(headers);
  rows.forEach((row) => sheet.addRow(row));
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  headers.forEach((_, index) => { sheet.getColumn(index + 1).width = widths[index] ?? 28; });
  sheet.getRow(1).height = 30;
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF164E72" } };
  });
  sheet.eachRow((row, index) => {
    if (index > 1) row.height = name === "Report" ? 60 : 44;
    row.eachCell((cell) => { cell.alignment = { vertical: "top", wrapText: true }; });
  });
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rowCount), column: headers.length } };
  return sheet;
}
export async function writeServiceTemplate(services: { label: string }[]): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  sheetWithRows(book, "Servizi", [...SERVICE_IMPORT_COLUMNS], [], [28, 28, 42]);
  sheetWithRows(book, "Istruzioni", ["Importazione dei servizi"], [
    ["Compila il foglio Servizi: nome, cognome e servizio, una associazione per riga. Massimo 500 righe e 2 MiB, solo testo semplice."],
    ["Si cercano soltanto iscrizioni non eliminate nell’evento corrente, anche fuori dai filtri della tabella. Questo import non crea partecipanti, account o servizi."],
    ["Il nome e il cognome devono corrispondere esattamente, salvo maiuscole e spazi. Accenti e punteggiatura restano significativi. Gli omonimi non vengono assegnati."],
    ["Copia il nome di un servizio attivo dal foglio Catalogo servizi. Il servizio sarà assegnato, aggiornando quello eventualmente presente. I ruoli di accesso al sito non vengono modificati."],
    ["Nominativi ripetuti con servizi diversi: tutte le relative righe vengono escluse. Associazioni identiche ripetute: applicate una sola volta."],
    ["Al termine scarica il report: include il numero della riga originale, l’esito e le indicazioni per correggere manualmente i casi non risolti."],
  ], [110]);
  sheetWithRows(book, "Catalogo servizi", ["Servizi attivi"], services.map((service) => [service.label]), [60]);
  return Buffer.from(await book.xlsx.writeBuffer());
}
export async function writeServiceReport(rows: ServiceImportResultRow[]): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  const counts = serviceImportSummary(rows);
  sheetWithRows(book, "Riepilogo", ["Esito", "Righe"], [
    ["Righe esaminate", rows.length],
    ...Object.entries(counts).map(([status, count]) => [SERVICE_IMPORT_STATUS[status as keyof typeof counts], count]),
  ], [55, 16]);
  // ExcelJS stores strings explicitly, including leading =, +, - and @.
  sheetWithRows(book, "Report", ["Riga Excel", "Nome", "Cognome", "Servizio richiesto", "Esito", "Dettaglio"],
    rows.map((row) => [row.row, row.firstName, row.lastName, row.service, SERVICE_IMPORT_STATUS[row.status], serviceImportDetail(row)]),
    [14, 24, 24, 34, 38, 90]);
  return Buffer.from(await book.xlsx.writeBuffer());
}
