import PDFDocument from "pdfkit";
import JSZip from "jszip";
import path from "node:path";
import type { PanelRoster } from "./panel-roster.server.ts";

export async function writePanelRosterPdf(roster: PanelRoster, session: string, extractedAt = new Date()): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true, font: path.join(process.cwd(), "lib/qrcode/fonts/NotoSans-Regular.ttf") });
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", chunk => chunks.push(chunk)); doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject);
  });
  doc.fontSize(16).fillColor("#123955").text(roster.title);
  doc.moveDown(0.4).fontSize(10).fillColor("#333333").text(session);
  doc.text(`Estratto il ${extractedAt.toLocaleString("it-IT", { timeZone: "Europe/Rome" })} (Roma)`);
  doc.moveDown().text(`Confermati: ${roster.individualSeats} | In attesa: ${roster.waitlist.length}`);
  doc.text(`Scuole: ${roster.schoolSeats} persone | Posti ospiti riservati: ${roster.reservedGuestSeats}`);
  const table = (title: string, headings: string[], widths: number[], rows: string[][]) => {
    const drawRow = (cells: string[], header = false) => {
      doc.fontSize(8).fillColor(header ? "#123955" : "#222222");
      const height = Math.max(22, ...cells.map((cell, i) => doc.heightOfString(cell || "-", { width: widths[i] - 12 }) + 12));
      const y = doc.y;
      let x = 40;
      if (header) doc.rect(x, y, 515, height).fill("#eaf1f6");
      cells.forEach((cell, i) => { doc.fillColor(header ? "#123955" : "#222222").text(cell || "-", x + 6, y + 6, { width: widths[i] - 12 }); x += widths[i]; });
      doc.moveTo(40, y + height).lineTo(555, y + height).strokeColor("#d9e1e6").stroke();
      doc.x = 40; doc.y = y + height;
    };
    if (doc.y > 680) doc.addPage();
    doc.moveDown().fontSize(12).fillColor("#123955").text(title).moveDown(0.5);
    drawRow(headings, true);
    if (!rows.length) rows = [["Nessuna voce", ...headings.slice(1).map(() => "")]];
    for (const row of rows) {
      doc.fontSize(8);
      const height = Math.max(22, ...row.map((cell, i) => doc.heightOfString(cell || "-", { width: widths[i] - 12 }) + 12));
      if (doc.y + height > 775) { doc.addPage(); doc.fontSize(11).fillColor("#123955").text(`${title} (segue)`).moveDown(0.5); drawRow(headings, true); }
      drawRow(row);
    }
  };
  const identity = (p: PanelRoster["people"][number]) => [`${p.lastName} ${p.firstName}`.trim(), p.groupName ?? "Senza gruppo", p.kind, p.accompanyingAdult, p.code];
  table("Iscritti confermati", ["Cognome e nome", "Gruppo", "Tipo", "Accompagnatore", "Codice"], [140, 110, 75, 125, 65], roster.people.map(identity));
  table("Lista d’attesa (ordine di richiesta)", ["Cognome e nome", "Gruppo", "Tipo", "Accompagnatore", "Stato"], [135, 105, 65, 100, 110], roster.waitlist.map(p => [identity(p)[0], p.groupName ?? "Senza gruppo", p.kind, p.accompanyingAdult, p.status === "offered" ? `Posto offerto, da confermare entro ${new Date(p.expiresAt!).toLocaleString("it-IT", { timeZone: "Europe/Rome" })}` : "In lista d’attesa"]));
  if (roster.schools.length) table("Prenotazioni scuole", ["Scuola / città", "Classe", "Studenti", "Accompagnatori"], [230, 135, 65, 85], roster.schools.map(s => [`${s.name} / ${s.city}`, s.classDescription, String(s.students), String(s.companions)]));
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) { doc.switchToPage(i); doc.fontSize(8).fillColor("#666666").text(`Pagina ${i + 1} di ${range.count}`, 40, 782, { width: 515, align: "right", lineBreak: false }); }
  doc.end();
  return result;
}

export async function writePanelRosterZip(rosters: PanelRoster[], session: string): Promise<Buffer> {
  const zip = new JSZip();
  const extractedAt = new Date();
  for (const [index, roster] of rosters.entries()) {
    const name = roster.title.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
    zip.file(`${String(index + 1).padStart(2, "0")}-${name || "forum"}.pdf`, await writePanelRosterPdf(roster, session, extractedAt));
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
