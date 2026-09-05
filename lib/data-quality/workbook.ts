import ExcelJS from "exceljs";
import yauzl from "yauzl";
import {
  COLUMNS,
  FORMAT_INSTRUCTIONS,
  FORMAT_VERSION,
  MAX_FILE_BYTES,
  MAX_IMPORT_ROWS,
  type Catalog,
  type ExcelRow,
} from "./format.ts";

// Inspect and fully drain each entry with an actual decompression budget before
// ExcelJS materializes the workbook. Never extract uploaded archives to disk.
async function inspectArchive(buffer: Buffer): Promise<void> {
  if (buffer.length > MAX_FILE_BYTES) throw new Error("Il file supera 2 MiB.");
  await new Promise<void>((resolve, reject) =>
    yauzl.fromBuffer(
      buffer,
      { lazyEntries: true, validateEntrySizes: true },
      (error, zip) => {
        if (error || !zip)
          return reject(new Error("File .xlsx non valido o cifrato."));
        let bytes = 0,
          entries = 0;
        const fail = (reason: unknown) => {
          zip.close();
          reject(reason);
        };
        zip.on("error", fail);
        zip.on("end", resolve);
        zip.on("entry", (entry: yauzl.Entry) => {
          if (
            ++entries > 100 ||
            entry.uncompressedSize > 10 * 1024 * 1024 ||
            /vbaProject|externalLinks|embeddings/i.test(entry.fileName) ||
            entry.isEncrypted()
          )
            return fail(
              new Error("Archivio troppo grande o con contenuti non ammessi."),
            );
          zip.openReadStream(entry, (readError, stream) => {
            if (readError || !stream)
              return fail(new Error("Archivio non valido."));
            const chunks: Buffer[] = [];
            stream.on("error", fail);
            stream.on("data", (chunk: Buffer) => {
              bytes += chunk.length;
              if (bytes > 10 * 1024 * 1024) {
                stream.destroy();
                fail(new Error("Contenuto decompresso oltre 10 MiB."));
                return;
              }
              if (/\.xml$|\.rels$/.test(entry.fileName)) chunks.push(chunk);
            });
            stream.on("end", () => {
              const xml = Buffer.concat(chunks).toString("utf8");
              if (
                /<!DOCTYPE|<!ENTITY|TargetMode\s*=\s*["']External|<(?:\w+:)?f(?:\s|>|\/)/i.test(
                  xml,
                )
              )
                return fail(
                  new Error("Formule o collegamenti esterni non ammessi."),
                );
              if (/xl\/worksheets\//.test(entry.fileName)) {
                let cells = 0;
                for (const match of xml.matchAll(
                  /<(?:\w+:)?c\b[^>]*\br=["']([A-Z]+)(\d+)["']/g,
                )) {
                  let column = 0;
                  for (const letter of match[1])
                    column = column * 26 + letter.charCodeAt(0) - 64;
                  if (
                    ++cells > 50_000 ||
                    column > COLUMNS.length ||
                    Number(match[2]) > 5001
                  )
                    return fail(
                      new Error(
                        "Dimensioni del foglio fuori dai limiti del modello.",
                      ),
                    );
                }
              }
              zip.readEntry();
            });
          });
        });
        zip.readEntry();
      },
    ),
  );
}
export async function readWorkbook(
  buffer: Buffer,
): Promise<{ row: number; values: ExcelRow; cellErrors: string[] }[]> {
  await inspectArchive(buffer);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(
    buffer as unknown as Parameters<typeof book.xlsx.load>[0],
  );
  if (
    book.worksheets.some(
      (sheet) =>
        ![
          "Partecipanti",
          "Istruzioni",
          "Esempi",
          "Cataloghi",
          "Minori",
          "Presenze",
        ].includes(sheet.name),
    )
  )
    throw new Error("Foglio imprevisto. Usa il modello canonico.");
  const sheet = book.getWorksheet("Partecipanti");
  if (
    !sheet ||
    sheet.columnCount !== COLUMNS.length ||
    COLUMNS.some((name, i) => sheet.getRow(1).getCell(i + 1).value !== name)
  )
    throw new Error(
      "Intestazioni mancanti, riordinate o impreviste. Usa il modello canonico.",
    );
  if (sheet.rowCount > MAX_IMPORT_ROWS + 1)
    throw new Error("Il file supera 500 righe. Dividilo in più file.");
  const rows: { row: number; values: ExcelRow; cellErrors: string[] }[] = [];
  sheet.eachRow((row, index) => {
    if (index === 1) return;
    const errors: string[] = [];
    const values = Object.fromEntries(
      COLUMNS.map((column, i) => {
        const cell = row.getCell(i + 1);
        const value = cell.value;
        if (value !== null && typeof value !== "string")
          errors.push(
            `${column}: usa testo semplice, senza formule, date numeriche o collegamenti`,
          );
        return [
          column,
          typeof value === "string"
            ? value
            : value === null
              ? ""
              : String(cell.text),
        ];
      }),
    ) as ExcelRow;
    if (Object.values(values).some(Boolean))
      rows.push({ row: index, values, cellErrors: errors });
  });
  if (!rows.length) throw new Error("Il foglio Partecipanti è vuoto.");
  return rows;
}
// Explicit string cells ensure Excel never interprets leading '=', '+', '-' or
// '@' as formulas. Values remain round-trippable (including E.164 phones).
function addSheet(
  book: ExcelJS.Workbook,
  name: string,
  headers: readonly string[],
  rows: string[][],
) {
  const sheet = book.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.addRow([...headers]);
  for (const row of rows) sheet.addRow(row.map((value) => String(value ?? "")));
  sheet.columns.forEach((column) => {
    column.width = 24;
    column.numFmt = "@";
  });
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF124A7A" },
  };
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, sheet.rowCount), column: headers.length },
  };
  return sheet;
}
export async function writeWorkbook(
  rows: ExcelRow[],
  catalog: Catalog,
  extras?: { children: string[][]; attendance: string[][] },
): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  book.creator = "Iscrizioni Pace";
  book.subject = FORMAT_VERSION;
  addSheet(
    book,
    "Partecipanti",
    COLUMNS,
    rows.map((row) => COLUMNS.map((column) => row[column])),
  );
  const instructions = addSheet(
    book,
    "Istruzioni",
    [FORMAT_VERSION],
    FORMAT_INSTRUCTIONS.map((text) => [text]),
  );
  instructions.getColumn(1).width = 110;
  instructions.eachRow((row) => {
    row.alignment = { wrapText: true, vertical: "top" };
    row.height = 65;
  });
  addSheet(book, "Esempi", COLUMNS, [
    [
      "Maria",
      "Rossi",
      "1990-05-20",
      "maria@example.test",
      "+393331234567",
      "Italia",
      "Roma",
      "",
      "",
      "",
      "",
      "submitted",
      "si",
      "VERSIONE_INFORMATIVA_ACCETTATA",
      "2026-09-01",
    ],
  ]);
  addSheet(
    book,
    "Cataloghi",
    ["tipo", "id", "nome"],
    [
      ...catalog.groups.map((item) => ["gruppo", item.id, item.label]),
      ...catalog.services.map((item) => ["servizio", item.id, item.label]),
      ...catalog.tags.map((item) => ["tag", item.id, item.label]),
    ],
  );
  if (extras) {
    addSheet(
      book,
      "Minori",
      ["iscrizione_id", "adulto", "nome", "cognome", "data_nascita"],
      extras.children,
    );
    addSheet(
      book,
      "Presenze",
      ["iscrizione_id", "partecipante", "giorno", "fascia", "scelta"],
      extras.attendance,
    );
  }
  return Buffer.from(await book.xlsx.writeBuffer());
}
