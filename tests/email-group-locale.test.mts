import assert from "node:assert/strict";
import test from "node:test";
import { emailLocaleForCountry, groupCountryId, type EmailLocaleGroup } from "../lib/email/group-locale.ts";
import { loadGroupEmailLocale, loadRegistrationEmailLocale } from "../lib/email/group-locale.server.ts";
import { renderAccountAccessEmail } from "../lib/email/account-access.ts";

const group = (id: string, parent: string | null, country: string | null, type = "group"): EmailLocaleGroup => ({
  id, event_id: "event", parent_group_id: parent, country_id: country, node_type: type, is_active: true,
});

test("country mapping uses supported country languages and English everywhere else", () => {
  for (const [country, locale] of Object.entries({ IT: "it", FR: "fr", DE: "de", ES: "es", NL: "nl", UA: "uk", GB: "en", PL: "en", CH: "en", AT: "en", BE: "en", XX: "en" })) {
    assert.equal(emailLocaleForCountry(country), locale);
  }
  assert.equal(emailLocaleForCountry(" it "), "it");
  assert.equal(emailLocaleForCountry(null), "en");
});

test("all descendants of Italy inherit Italian even with missing or conflicting leaf geography", () => {
  const groups = [group("italy", null, "IT", "country"), group("rome", "italy", null, "city"), group("esquilino", "rome", "FR")];
  assert.equal(groupCountryId(groups, "event", "esquilino"), "IT");
  assert.equal(groupCountryId([group("standalone", null, "ES")], "event", "standalone"), "ES");
  assert.equal(groupCountryId([group("unknown", null, null)], "event", "unknown"), null);
  assert.throws(() => groupCountryId(groups, "other-event", "esquilino"));
  assert.throws(() => groupCountryId([group("a", "b", "IT"), group("b", "a", null)], "event", "a"));
  assert.throws(() => groupCountryId([group("a", "missing", "IT")], "event", "a"));
  assert.throws(() => groupCountryId([{ ...groups[0], is_active: false }, ...groups.slice(1)], "event", "esquilino"));
});

type Row = Record<string, unknown>;
function fixture() {
  const tables: Record<string, Row[]> = {
    registrations: [{ id: "reg", event_id: "event", status: "submitted", deleted_at: null }],
    participant_group_assignments: [{ registration_id: "reg", group_id: "esquilino", is_current: true }, { registration_id: "reg", group_id: "old", is_current: false }],
    groups: [group("italy", null, "country-it", "country"), group("esquilino", "italy", null)],
    countries: [{ id: "country-it", iso2: "IT" }],
  };
  const ranges: number[] = [];
  const db = (failTable?: string) => ({ from(table: string) {
    let rows = tables[table] ?? [];
    const result = () => ({ data: rows, error: table === failTable ? { message: "read failed" } : null });
    const query = {
      select() { return this; }, order() { return this; },
      eq(key: string, value: unknown) { rows = rows.filter(row => row[key] === value); return this; },
      is(key: string, value: unknown) { return this.eq(key, value); },
      limit(n: number) { rows = rows.slice(0, n); return this; },
      range(from: number, to: number) { if (table === "groups") ranges.push(from); rows = rows.slice(from, to + 1); return this; },
      single() { return Promise.resolve({ ...result(), data: rows.length === 1 ? rows[0] : null }); },
      then(resolve: (r: unknown) => unknown) { return Promise.resolve(result()).then(resolve); },
    };
    return query;
  } });
  return { tables, ranges, db };
}

test("server resolves the current assignment and pages past 1,000 groups", async () => {
  const h = fixture();
  h.tables.groups = [...Array.from({ length: 1100 }, (_, i) => group(`unused-${i}`, null, null)), ...h.tables.groups];
  const language = await loadRegistrationEmailLocale(h.db() as never, "event", "reg");
  assert.deepEqual(language, { locale: "it", countryIso2: "IT", groupId: "esquilino" });
  assert.deepEqual(h.ranges, [0, 500, 1000]);
});

test("database errors, deleted/wrong-event registrations and ambiguous assignments stop language resolution", async () => {
  for (const table of ["registrations", "participant_group_assignments", "groups", "countries"]) {
    const h = fixture();
    await assert.rejects(loadRegistrationEmailLocale(h.db(table) as never, "event", "reg"), /./, table);
  }
  const h = fixture();
  await assert.rejects(loadRegistrationEmailLocale(h.db() as never, "another-event", "reg"));
  h.tables.registrations[0].deleted_at = "2026-09-11";
  await assert.rejects(loadRegistrationEmailLocale(h.db() as never, "event", "reg"));
  h.tables.registrations[0].deleted_at = null;
  h.tables.participant_group_assignments[1].is_current = true;
  await assert.rejects(loadRegistrationEmailLocale(h.db() as never, "event", "reg"));
});

test("unknown country or no current group uses English, while database failures never silently do", async () => {
  const h = fixture(); h.tables.countries[0].iso2 = "PL";
  assert.equal((await loadRegistrationEmailLocale(h.db() as never, "event", "reg")).locale, "en");
  h.tables.participant_group_assignments = [];
  assert.equal((await loadRegistrationEmailLocale(h.db() as never, "event", "reg")).locale, "en");
  assert.equal((await loadGroupEmailLocale(h.db() as never, "event", null)).locale, "en");
});

test("role notifications are rendered in the selected language, including English fallback", () => {
  const subjects = new Set<string>();
  for (const locale of ["it", "en", "fr", "de", "es", "nl", "uk"]) {
    const mail = renderAccountAccessEmail({ name: "Example", siteLink: "https://example.test", role: "capogruppo", locale });
    assert.ok(!mail.text.includes("{role}"));
    assert.ok(!mail.subject.includes("{role}"));
    subjects.add(mail.subject);
  }
  assert.equal(subjects.size, 7);
  assert.equal(renderAccountAccessEmail({ name: "Example", siteLink: "https://example.test", role: "capogruppo" }).subject, "Your access as Group leader");
});
