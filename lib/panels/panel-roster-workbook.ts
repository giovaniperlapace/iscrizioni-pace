import ExcelJS from "exceljs";
import type { PanelRoster } from "./panel-roster.server.ts";

export async function writePanelRosterWorkbook(roster: PanelRoster): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  book.creator = "Iscrizioni Pace";
  const add = (name: string, headers: string[], rows: (string | number)[][]) => {
    const sheet = book.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    sheet.addRow(headers);
    for (const row of rows) sheet.addRow(row); // strings are literal cells, never formulas
    sheet.columns.forEach(column => { column.width = 28; });
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF124A7A" } };
    sheet.eachRow(row => { row.alignment = { vertical: "top", wrapText: true }; });
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rowCount), column: headers.length } };
    sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:1" };
  };
  add("Riepilogo", ["Voce", "Valore"], [
    ["Panel", roster.title], ["Data export (Roma)", new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" })],
    ["Iscritti e minori accompagnati", roster.individualSeats], ["Studenti e accompagnatori scuole", roster.schoolSeats],
    ["Totale posti prenotati", roster.individualSeats + roster.schoolSeats], ["Posti ospiti riservati", roster.reservedGuestSeats],
    ["Prenotati e riservati", roster.individualSeats + roster.schoolSeats + roster.reservedGuestSeats],
    ["Nota", "Gli ospiti sono posti riservati, esclusi dal form pubblico. Non rappresentano iscrizioni o presenze registrate."],
  ]);
  add("Partecipanti", ["Nome", "Cognome", "Tipo", "Adulto accompagnatore", "Codice", "Posti"], roster.people.map(row => [row.firstName, row.lastName, row.kind, row.accompanyingAdult, row.code, 1]));
  add("Scuole", ["Scuola", "Città", "Classe / gruppo", "Studenti", "Accompagnatori", "Posti"], roster.schools.map(row => [row.name, row.city, row.classDescription, row.students, row.companions, row.students + row.companions]));
  add("Ospiti riservati", ["Quota", "Posti riservati"], roster.guests.map(row => [row.name, row.seats]));
  return Buffer.from(await book.xlsx.writeBuffer());
}
