// Use only the disposable database populated by service-import.sql.
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import assert from "node:assert/strict";
const [port = "55447", database = "service_import_test"] = process.argv.slice(2);
if (!/^55\d{3}$/.test(port) || !/^service_import_test$/.test(database)) throw new Error("Disposable local database required");
const args = ["-h", "127.0.0.1", "-p", port, "-d", database, "-X", "-v", "ON_ERROR_STOP=1", "-Atc"];
const sql = (query) => execFileSync("psql", [...args, query], { encoding: "utf8" }).trim();
const asyncSql = (query) => promisify(execFile)("psql", [...args, query]);
async function barrier() {
  for (let i = 0; i < 100; i++) {
    if (sql("select count(*) from pg_stat_activity where application_name='service-import-race' and wait_event='PgSleep'") === "1") return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Concurrent transaction did not reach barrier");
}
sql("insert into participants(id,first_name,last_name) values(f(3000),'Race','Person'); insert into registrations(id,participant_id,event_id) values(f(3000),f(3000),f(1))");
const namesake = asyncSql("set application_name='service-import-race'; begin; insert into participants(id,first_name,last_name) values(f(3001),'Race','Person'); insert into registrations(id,participant_id,event_id) values(f(3001),f(3001),f(1)); select pg_sleep(1); commit;");
await barrier();
const matched = asyncSql("select import_participant_services(f(600),f(1),f(31),jsonb_build_array(import_row(2,'Race','Person','Accoglienza')))->'rows'->0->>'status'");
const result = await matched; await namesake;
assert.equal(result.stdout.trim(), "ambiguous");
assert.equal(sql("select count(*) from participant_event_services where participant_id in(f(3000),f(3001))"), "0");
console.log("PASS namesake committed during import is included in matching");

sql("insert into participants(id,first_name,last_name) values(f(3002),'Retry','Person'); insert into registrations(id,participant_id,event_id) values(f(3002),f(3002),f(1))");
const call = "select import_participant_services(f(601),f(1),f(31),jsonb_build_array(import_row(2,'Retry','Person','Accoglienza')))";
const first = asyncSql(`set application_name='service-import-race'; begin; ${call}; select pg_sleep(1); commit;`);
await barrier();
const second = asyncSql(`${call}->>'replayed'`);
assert.equal((await second).stdout.trim(), "true"); await first;
assert.equal(sql("select count(*) from audit_logs where action='participant.event_service_imported' and metadata->>'import_id'=f(601)::text"), "1");
console.log("PASS simultaneous retry returns one receipt and one assignment audit");

// Cancellation committed before matching is never silently restored by import.
sql("insert into participants(id,first_name,last_name) values(f(3003),'Deleted','Race'); insert into registrations(id,participant_id,event_id) values(f(3003),f(3003),f(1))");
const cancellation = asyncSql("set application_name='service-import-race'; begin; update registrations set deleted_at=now() where id=f(3003); select pg_sleep(1); commit;");
await barrier();
const cancelled = await asyncSql("select import_participant_services(f(602),f(1),f(31),jsonb_build_array(import_row(2,'Deleted','Race','Accoglienza')))->'rows'->0->>'status'");
await cancellation;
assert.equal(cancelled.stdout.trim(), "not_found");
assert.equal(sql("select count(*) from participant_event_services where participant_id=f(3003)"), "0");
console.log("PASS concurrent cancellation blocks assignment without restoring any registration");

const start = performance.now();
const bulk = JSON.parse(sql("select import_participant_services(f(603),f(1),f(31),(select jsonb_agg(import_row(i,'Fixture '||i,'Omonimo','Accoglienza')) from generate_series(2,501) i))"));
assert.equal(bulk.rows.length, 500);
assert.ok(bulk.rows.every((row) => row.status === "updated"));
console.log(`PASS 500-row batch matched and assigned in ${Math.round(performance.now() - start)} ms against more than 1,200 existing registrations`);
