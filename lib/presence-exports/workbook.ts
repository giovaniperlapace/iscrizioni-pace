import ExcelJS from "exceljs";
import type { PresenceReport } from "./types.ts";

const blue = "183F59", pale = "E7F0F5", ink = "172F3D";
const timestamp = (value: string) => new Intl.DateTimeFormat("it-IT", {
  dateStyle: "short", timeStyle: "medium", timeZone: "Europe/Rome",
}).format(new Date(value));

// Runtime exports use the application's existing ExcelJS dependency. Strings
// are literal XLSX strings (never formulas), including group/tag/service labels.
export async function writePresenceWorkbook(report: PresenceReport): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  book.creator = "Registrazioni Pace";
  book.created = new Date(report.extractedAt);
  book.calcProperties.fullCalcOnLoad = true;
  const sheet = book.addWorksheet("Presenze", {
    views: [{ state: "frozen", xSplit: 1, ySplit: 6, showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.15, footer: 0.15 }, printTitlesRow: "6:6" },
  });
  const n = report.headers.length;
  const wideRow = (text: string, height: number, size: number, bold = false) => {
    const row = sheet.addRow([text]);
    sheet.mergeCells(row.number, 1, row.number, n);
    row.height = height;
    row.font = { name: "Calibri", size, bold, color: { argb: ink } };
    row.alignment = { vertical: "middle", wrapText: true };
    return row;
  };
  wideRow(`REPORT ${report.variant.toUpperCase().replace("2", "/2")} — ${report.title}`, 29, 16, true);
  wideRow(report.eventTitle, 24, 11);
  wideRow(`Estrazione avviata il ${timestamp(report.extractedAt)} (ora di Roma)`, 21, 10);
  wideRow("Iscritti e figli accompagnati inclusi. I figli restano nel gruppo d’iscrizione e condividono le presenze del genitore.", 25, 10);
  wideRow(report.warnings.length ? "Sono presenti voci da classificare o verificare, incluse nel totale. Vedere il foglio Raccordo." : "Date non indicate = persone senza fasce di presenza confermate nel calendario. Totale persone = persone distinte.", 25, 10);
  const header = sheet.addRow(report.headers);
  header.height = 34;
  header.eachCell(cell => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: blue } };
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: Number(cell.col) === 1 ? "left" : "center", wrapText: true };
  });
  sheet.getColumn(1).width = 52;
  for (let i = 2; i <= n; i++) { sheet.getColumn(i).width = i === n ? 14 : 12; sheet.getColumn(i).numFmt = "#,##0"; }
  let firstDetail = 7;
  const subtotalRows: number[] = [];
  for (const line of report.lines) {
    const row = sheet.addRow([line.label, ...line.values]);
    const summary = line.kind !== "detail";
    row.height = line.label.length > 100 ? 55 : line.label.length > 49 ? 32 : 21;
    row.eachCell(cell => {
      cell.font = { name: "Calibri", size: 11, bold: summary, color: { argb: line.kind === "total" ? "FFFFFF" : ink } };
      cell.alignment = { vertical: "middle", wrapText: true, horizontal: Number(cell.col) === 1 ? "left" : "right" };
      if (summary || row.number % 2 === 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: line.kind === "total" ? blue : summary ? pale : "F7F9FB" } };
      if (summary) cell.border = { top: { style: "thin", color: { argb: "B5CCD9" } } };
    });
    if (line.kind === "subtotal" || line.kind === "total") {
      for (let col = 2; col <= n; col++) {
        const letter = sheet.getColumn(col).letter;
        const formula = line.kind === "subtotal" ? `SUM(${letter}${firstDetail}:${letter}${row.number - 1})`
          : subtotalRows.length ? `SUM(${subtotalRows.map(index => `${letter}${index}`).join(",")})` : "0";
        row.getCell(col).value = { formula, result: line.values[col - 2] };
      }
      if (line.kind === "subtotal") { subtotalRows.push(row.number); firstDetail = row.number + 1; }
    }
  }
  sheet.pageSetup.printArea = `A1:${sheet.getColumn(n).letter}${sheet.rowCount}`;
  sheet.headerFooter.oddFooter = `&LReport ${report.variant.toUpperCase()} - ${timestamp(report.extractedAt)} (Roma)&RPagina &P di &N`;
  sheet.headerFooter.oddHeader = `&LReport ${report.variant.toUpperCase()} - Presenze per gruppo`;

  const mapping = book.addWorksheet("Raccordo", { views: [{ state: "frozen", ySplit: 8, showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "8:8" } });
  const notes = [
    `Raccordo gruppi, zone e tag — versione ${report.configVersion ?? "non disponibile"}`,
    "Fonte: Gruppi_ZRT.xlsx. Collegamenti ai gruppi per ID; zone e raggruppamenti ereditati dal nodo superiore se disponibili.",
    "Report B e B/2: tag operatore > servizio assegnato > gruppo d’iscrizione. Preferenze, proposte e rifiuti non sono servizi assegnati.",
    "Figli: sempre nel gruppo d’iscrizione; nessun servizio o tag del genitore attribuito automaticamente.",
    "Date non indicate: nessuna presenza confermata nel calendario, comprese le presenze da comunicare. Fasce storiche senza mattina/pomeriggio: entrambe, se previste.",
    "Sono incluse solo iscrizioni non eliminate dell’evento corrente. I numeri delle fasce non si sommano per ottenere il totale delle persone.",
    report.warnings.join(" ") || "I tag previsti ma non presenti nel catalogo non generano operatori. Nuovi tag con lo stesso nome saranno riconosciuti al download successivo.",
  ];
  for (const text of notes) {
    const row = mapping.addRow([text]); mapping.mergeCells(row.number, 1, row.number, 5);
    row.height = row.number === 1 ? 30 : 32;
    row.font = { name: "Calibri", size: row.number === 1 ? 14 : 10, bold: row.number === 1, color: { argb: ink } };
    row.alignment = { vertical: "middle", wrapText: true };
  }
  mapping.addRow(["Gruppo", "Zona", "Raggruppamento", "Tag operatore", "Stato del raccordo", "ID gruppo"]);
  report.mapping.forEach(item => mapping.addRow([item.name, item.zone, item.rollup || null, item.tag || null, item.status, item.groupId]));
  [45, 22, 29, 20, 43, 39].forEach((width, index) => { mapping.getColumn(index + 1).width = width; });
  mapping.getColumn(6).hidden = true;
  mapping.eachRow((row, rowNumber) => {
    if (rowNumber < 8) return;
    row.height = 33;
    row.eachCell(cell => {
      cell.font = { name: "Calibri", size: 10, bold: rowNumber === 8, color: { argb: rowNumber === 8 ? "FFFFFF" : ink } };
      cell.alignment = { vertical: "middle", wrapText: true };
      if (rowNumber === 8) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: blue } };
    });
  });
  mapping.autoFilter = { from: "A8", to: `F${mapping.rowCount}` };
  mapping.pageSetup.printArea = `A1:E${mapping.rowCount}`;
  mapping.headerFooter.oddFooter = `&LRaccordo - ${timestamp(report.extractedAt)} (Roma)&RPagina &P di &N`;
  return Buffer.from(await book.xlsx.writeBuffer());
}
