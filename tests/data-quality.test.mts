import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  compareIdentities,
  findDuplicates,
  levenshtein,
  normalizeText,
  type Identity,
} from "../lib/data-quality/duplicates.ts";
import {
  COLUMNS,
  validateExcelRow,
  validDate,
  MAX_FILE_BYTES,
  type ExcelRow,
} from "../lib/data-quality/format.ts";
import {
  buildPreviewRows,
  validateDecisions,
} from "../lib/data-quality/preview.ts";
import { readWorkbook, writeWorkbook } from "../lib/data-quality/workbook.ts";
import {
  openQualityPayload,
  sealQualityPayload,
} from "../lib/data-quality/seal.server.ts";
const load = (book: ExcelJS.Workbook, buffer: Buffer) =>
  book.xlsx.load(buffer as unknown as Parameters<typeof book.xlsx.load>[0]);
const person: Identity = {
  id: "a",
  firstName: "María",
  lastName: "D’Angelo",
  birthDate: "1990-01-01",
  email: "maria@example.test",
  phone: "+393331234567",
  country: "Italia",
  city: "Roma",
};
const other = (patch: Partial<Identity> = {}): Identity => ({
  ...person,
  id: "b",
  ...patch,
});
const catalog = {
  groups: [{ id: "g1", label: "Roma" }],
  services: [{ id: "s1", label: "Accoglienza" }],
  tags: [{ id: "t1", label: "Referente" }],
};
const row = (patch: Partial<ExcelRow> = {}): ExcelRow => ({
  nome: "Maria",
  cognome: "Rossi",
  data_nascita: "1990-01-01",
  email: "maria@example.test",
  telefono: "+393331234567",
  paese: "Italia",
  citta: "Roma",
  gruppo: "",
  servizio: "",
  stato_servizio: "",
  tag: "",
  stato: "submitted",
  consenso_privacy: "si",
  versione_privacy: "fixture",
  data_consenso: "2026-01-01",
  ...patch,
});

test("normalization, Unicode and Levenshtein", () => {
  assert.equal(normalizeText("  María D’Angelo "), "maria d angelo");
  assert.equal(levenshtein("kitten", "sitting"), 3);
  assert.equal(levenshtein("", "abc"), 3);
});
test("evidence tiers never equate fuzzy-only names with exact identities", () => {
  assert.equal(
    compareIdentities(
      person,
      other({ firstName: "Maria", lastName: "D Angelo" }),
    )?.level,
    "exact",
  );
  assert.equal(
    compareIdentities(person, other({ email: null, phone: null }))?.level,
    "likely",
  );
  assert.equal(
    compareIdentities(
      person,
      other({
        firstName: "Mario",
        birthDate: null,
        email: null,
        phone: null,
        country: null,
        city: null,
      }),
    ),
    null,
  );
  assert.equal(
    compareIdentities(person, other({ birthDate: "1995-01-01" }))?.level,
    "possible",
  );
  assert.equal(
    compareIdentities(
      person,
      other({ firstName: "Francesco", lastName: "Bianchi", birthDate: null }),
    )?.level,
    "possible",
  );
  assert.equal(compareIdentities(person, other(), true)?.level, "dismissed");
  assert.equal(
    findDuplicates([person, other()], new Set(["a:b"]))[0].level,
    "dismissed",
  );
});
test("date and catalog validation reject impossible dates, unknown and ambiguous options", () => {
  assert.equal(validDate("2026-02-30"), false);
  assert.equal(validDate("2026-19-01"), false);
  assert.equal(validDate("2030-01-01", "2026-09-05"), false);
  const result = validateExcelRow(
    row({
      gruppo: "Missing",
      servizio: "Unknown",
      tag: "Bad",
      telefono: "333",
    }),
    2,
    catalog,
  );
  assert.equal(result.errors.length, 5);
  const good = validateExcelRow(
    row({ gruppo: "g1", servizio: "Accoglienza", tag: "Referente;t1" }),
    2,
    catalog,
  );
  assert.deepEqual(good.tagIds, ["t1"]);
  assert.equal(good.errors.length, 0);
  assert.ok(
    validateExcelRow(row({ gruppo: "Roma" }), 2, {
      ...catalog,
      groups: [...catalog.groups, { id: "g2", label: "Roma" }],
    }).errors.length,
  );
});
test("preview detects existing and intra-file duplicates; errors and all skips require explicit choices", () => {
  const preview = buildPreviewRows(
    [
      { row: 2, values: row(), cellErrors: [] },
      { row: 3, values: row({ nome: "" }), cellErrors: [] },
    ],
    catalog,
    [{ ...person, lastName: "Rossi" }],
  );
  assert.ok(preview[0].candidates.some((match) => match.right === "a"));
  assert.ok(preview[0].candidates.some((match) => match.right === "row-3"));
  assert.throws(() => validateDecisions(preview, []));
  assert.throws(() =>
    validateDecisions(preview, [
      { row: 2, action: "import", reason: "different person" },
      { row: 3, action: "import", reason: "different person" },
    ]),
  );
  assert.equal(
    validateDecisions(preview, [
      { row: 2, action: "import", reason: "different person" },
      { row: 3, action: "skip", reason: "invalid name" },
    ]).length,
    2,
  );
  const archived = buildPreviewRows(
    [{ row: 2, values: row(), cellErrors: [] }],
    catalog,
    [{ ...person, lastName: "Rossi", deletedAt: "2026-01-01" }],
  );
  assert.throws(() =>
    validateDecisions(archived, [
      { row: 2, action: "import", reason: "different" },
    ]),
  );
});
test("canonical template is empty with examples on a separate sheet; export roundtrip preserves text and all rows", async () => {
  const template = await writeWorkbook([], catalog);
  const book = new ExcelJS.Workbook();
  await load(book, template);
  assert.equal(book.getWorksheet("Partecipanti")!.rowCount, 1);
  assert.equal(book.getWorksheet("Esempi")!.rowCount, 2);
  assert.deepEqual(
    (
      book.getWorksheet("Partecipanti")!.getRow(1).values as ExcelJS.CellValue[]
    ).slice(1),
    [...COLUMNS],
  );
  const buffer = await writeWorkbook(
    Array.from({ length: 501 }, () => row()),
    catalog,
  );
  await load(book, buffer);
  assert.equal(book.getWorksheet("Partecipanti")!.rowCount, 502);
  await assert.rejects(() => readWorkbook(buffer), /500/);
  const valid = await readWorkbook(await writeWorkbook([row()], catalog));
  assert.equal(valid[0].values.telefono, "+393331234567");
  assert.equal(valid[0].values.data_nascita, "1990-01-01");
});
test("reject unexpected columns, formulas, numeric dates, oversized files and external links", async () => {
  const book = new ExcelJS.Workbook();
  await load(book, await writeWorkbook([row()], catalog));
  const sheet = book.getWorksheet("Partecipanti")!;
  sheet.getCell("P1").value = "injected";
  await assert.rejects(async () =>
    readWorkbook(Buffer.from(await book.xlsx.writeBuffer())),
  );
  await load(book, await writeWorkbook([row()], catalog));
  book.getWorksheet("Partecipanti")!.getCell("A2").value = {
    formula: "1+1",
    result: 2,
  };
  await assert.rejects(
    async () => readWorkbook(Buffer.from(await book.xlsx.writeBuffer())),
    /Formule/,
  );
  await load(book, await writeWorkbook([row()], catalog));
  book.getWorksheet("Partecipanti")!.getCell("C2").value = 42000;
  assert.ok(
    (await readWorkbook(Buffer.from(await book.xlsx.writeBuffer())))[0]
      .cellErrors.length,
  );
  await assert.rejects(
    () => readWorkbook(Buffer.alloc(MAX_FILE_BYTES + 1)),
    /2 MiB/,
  );
  await load(book, await writeWorkbook([row()], catalog));
  book.getWorksheet("Partecipanti")!.getCell("A2").value = {
    text: "external",
    hyperlink: "https://example.test",
  };
  await assert.rejects(
    async () => readWorkbook(Buffer.from(await book.xlsx.writeBuffer())),
    /collegamenti/,
  );
});
test("export formula-like names remain string cells, never executable formulas", async () => {
  const book = new ExcelJS.Workbook();
  await load(
    book,
    await writeWorkbook(
      [row({ nome: '=HYPERLINK("https://example.test")' })],
      catalog,
    ),
  );
  assert.equal(
    book.getWorksheet("Partecipanti")!.getCell("A2").type,
    ExcelJS.ValueType.String,
  );
});
test("preview envelope rejects another operator, another event, wrong purpose, expiry and tampering", () => {
  process.env.QR_TOKEN_ENCRYPTION_SECRET = "synthetic-test-only";
  const payload = {
    kind: "import-v1",
    actor: "a",
    eventId: "e",
    expires: Date.now() + 60_000,
  };
  const token = sealQualityPayload(payload);
  assert.equal(openQualityPayload(token, "import-v1", "a", "e").actor, "a");
  assert.throws(() => openQualityPayload(token, "import-v1", "b", "e"));
  assert.throws(() => openQualityPayload(token, "import-v1", "a", "other"));
  assert.throws(() => openQualityPayload(token, "review-v1", "a", "e"));
  assert.throws(() =>
    openQualityPayload(token.slice(0, -8) + "tampered", "import-v1", "a", "e"),
  );
  assert.throws(() =>
    openQualityPayload(
      sealQualityPayload({ ...payload, expires: 0 }),
      "import-v1",
      "a",
      "e",
    ),
  );
});
