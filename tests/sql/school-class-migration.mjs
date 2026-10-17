import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
export function checkSchoolClassMigration(psql) {
 const migration=readFileSync('supabase/migrations/20261017180000_school_class_slot_constraints.sql','utf8');
 // Reproduce the pre-migration loophole, without creating any remote records.
 psql("select sd_create('migration@example.invalid',2,1);select sd_create('migration@example.invalid',2,1);");
 const snapshot=()=>psql(`select md5(jsonb_build_array(
 (select jsonb_agg(to_jsonb(b) order by id) from school_bookings b),
 (select jsonb_agg(to_jsonb(r) order by id) from school_panel_reservations r),
 (select jsonb_agg(to_jsonb(q) order by id) from school_booking_qr_tokens q),
 (select jsonb_agg(to_jsonb(t) order by id) from school_booking_teachers t),
 (select jsonb_agg(to_jsonb(a) order by id) from audit_logs a))::text);`,true).trim();
 const invalidBefore=snapshot();
 assert.throws(()=>psql('begin;'+migration+'commit;'),error=>/school_class_.*overlap/.test(String(error.stderr)));
 assert.equal(snapshot(),invalidBefore);
 assert.equal(psql("select to_regclass('app.school_class_reservations') is null;",true).trim(),'t');
 psql("update school_bookings set class_description='3B' where id=(select b.id from school_bookings b join school_booking_teachers t on t.id=b.teacher_id where t.email='migration@example.invalid' order by b.id limit 1);");
 const validBefore=snapshot();psql('begin;'+migration+'commit;');assert.equal(snapshot(),validBefore);
 assert.equal(psql('select count(*) from app.school_class_reservations;',true).trim(),'2');
 psql("begin;delete from school_panel_reservations where booking_id in(select b.id from school_bookings b join school_booking_teachers t on t.id=b.teacher_id where t.email='migration@example.invalid');delete from school_bookings where teacher_id in(select id from school_booking_teachers where email='migration@example.invalid');commit;");
 console.log('PASS migration refuses pre-existing conflicts atomically; valid backfill preserves canonical bookings, teachers, QR and audit');
}
