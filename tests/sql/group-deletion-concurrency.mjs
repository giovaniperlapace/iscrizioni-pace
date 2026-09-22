// Run only against the disposable DB populated by group-deletion.sql.
// node tests/sql/group-deletion-concurrency.mjs 55441 group_deletion_final
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
const [port, database] = process.argv.slice(2);
if (!/^55\d{3}$/.test(port ?? '') || !/^group_deletion_/.test(database ?? '')) throw new Error('Disposable local database required');
const args = ['-h', '127.0.0.1', '-p', port, '-d', database, '-X', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-Atc'];
const sql = query => execFileSync('psql', [...args, query], {encoding:'utf8'}).trim();
const asyncSql = query => promisify(execFile)('psql', [...args, query]);
async function waitForLock() {
 for (let i=0;i<50;i++) {
  if (sql("select count(*) from pg_stat_activity where application_name='group-delete-race' and wait_event='PgSleep'") === '1') return;
  await new Promise(r=>setTimeout(r,20));
 }
 throw new Error('Concurrent transaction did not reach lock barrier');
}
sql("insert into groups(id,event_id,name) values(f(26),f(1),'Concurrency fixture')");
let expected = sql("select manage_group_deletion(f(26),f(30))->>'expected'");
const rename = asyncSql("set application_name='group-delete-race'; begin; update groups set name='Concurrent edit' where id=f(26); select pg_sleep(1); commit;");
await waitForLock();
await assert.rejects(asyncSql(`select manage_group_deletion(f(26),f(30),true,'${expected}')`), error => error.stderr.includes('PT409'));
await rename;
expected = sql("select manage_group_deletion(f(26),f(30))->>'expected'");
const deletion = asyncSql(`set application_name='group-delete-race'; begin; select manage_group_deletion(f(26),f(30),true,'${expected}'); select pg_sleep(1); commit;`);
await waitForLock();
await Promise.all([
 assert.rejects(asyncSql("insert into group_memberships(id,group_id,user_id,role) values(f(560),f(26),f(34),'capogruppo')"), error => error.stderr.includes('23503')),
 assert.rejects(asyncSql("insert into groups(id,event_id,name,parent_group_id) values(f(27),f(1),'Racing child',f(26))"), error => error.stderr.includes('23503')),
 assert.rejects(asyncSql("insert into participant_group_assignments(id,registration_id,group_id,is_current) values(f(561),f(10),f(26),true)"), error => error.stderr.includes('23503')),
 deletion,
]);
assert.equal(sql("select count(*) from registrations"),'1207');
console.log('PASS concurrent rename produces PT409; racing membership, subgroup and assignment fail FK after deletion; registrations preserved');

sql("insert into groups(id,event_id,name) values(f(28),f(1),'Link race'); insert into group_registration_links(id,group_id,event_id,token_hash) values(f(580),f(28),f(1),'retired-concurrent-token')");
expected = sql("select manage_group_deletion(f(28),f(30))->>'expected'");
const deleteLink = asyncSql(`set application_name='group-delete-race'; begin; select manage_group_deletion(f(28),f(30),true,'${expected}'); select pg_sleep(1); commit;`);
await waitForLock();
await assert.rejects(asyncSql("insert into group_registration_links(id,group_id,event_id,token_hash) values(f(581),f(21),f(1),'retired-concurrent-token')"), error => error.stderr.includes('23505'));
await deleteLink;
assert.equal(sql("select count(*) from group_registration_links where token_hash='retired-concurrent-token'"),'0');
console.log('PASS concurrent link reuse after waiting for deletion is rejected');
