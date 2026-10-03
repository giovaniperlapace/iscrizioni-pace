// Run with PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js
// node tests/sql/participant-supported-locales.mts
// Uses only an ephemeral PostgreSQL database; no network or email transport.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SUPPORTED_LOCALES } from "../../lib/i18n/config.ts";

const { PGlite } = await import(process.env.PGLITE_MODULE ?? "@electric-sql/pglite");
const db = new PGlite();
try {
  // Use the original table definition so the pre-fix failure cannot be hidden
  // by a permissive mock. Unrelated foreign keys are omitted in this fixture.
  const initial = readFileSync(new URL("../../supabase/migrations/20260613120000_initial_schema_and_rls.sql", import.meta.url), "utf8");
  const table = initial.match(/create table public\.participants \([\s\S]*?\n\);/)![0]
    .replaceAll("extensions.gen_random_uuid()", "gen_random_uuid()")
    .replace(/ references [\w.]+\(id\)( on delete set null)?/g, "");
  await db.exec(table);
  const insert = (locale: string | null) => db.query(
    "insert into public.participants(first_name,last_name,preferred_locale) values ('Synthetic','Locale',$1) returning preferred_locale", [locale]);
  for (const locale of SUPPORTED_LOCALES) {
    if (locale === "it" || locale === "en") await insert(locale);
    else await assert.rejects(insert(locale), { code: "23514" });
  }
  const before = await db.query("select * from public.participants order by id");
  await db.exec(readFileSync(new URL("../../supabase/migrations/20260922120000_participant_supported_locales.sql", import.meta.url), "utf8"));
  assert.deepEqual((await db.query("select * from public.participants order by id")).rows, before.rows);
  for (const locale of SUPPORTED_LOCALES) {
    assert.equal((await insert(locale)).rows[0].preferred_locale, locale);
    await db.query("update public.participants set preferred_locale=$1 where first_name='Synthetic'", [locale]);
    console.log(`PASS insert and update: ${locale}`);
  }
  for (const locale of ["xx", "", "de-DE", "nl-NL"]) await assert.rejects(insert(locale), { code: "23514" });
  await assert.rejects(insert(null), { code: "23502" });
  assert.equal((await db.query("insert into public.participants(first_name,last_name) values ('Default','Locale') returning preferred_locale")).rows[0].preferred_locale, "it");
  console.log("PASS original bug reproduced in five languages; historical rows and default preserved; invalid/null locales rejected");
} finally {
  await db.close();
}
