import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
export async function checkGroupWaitlistConcurrency(psql,concurrent) {
 // The earlier last-seat race may have booked this person alone. Remove that
 // independent fixture booking before adding the family used by these checks.
 psql(`update moment_attendance_choices set choice='no',seat_section_id=null
 where registration_id=fw(104) and moment_id=fw(406);`);
 if(psql(`select count(*) from groups where id=fw(700);`,true).trim()==='0') {
  psql(readFileSync('tests/sql/group-panel-waitlist.sql','utf8').split("select set_config('request.jwt.claim.sub'")[0]+'commit;');
 }
 psql(`insert into group_memberships(group_id,user_id) values(fw(700),fw(9)) on conflict do nothing;
 update panel_waitlist set status='cancelled' where panel_id=fw(407) and status in ('waiting','offered');
 update moment_attendance_choices set choice='no',seat_section_id=null where moment_id in (fw(407),fw(408));
 update panel_seat_sections set capacity=0 where id=fw(507);
 update participants set auth_user_id=fw(4) where id=fw(24);`);
 // Two authenticated surfaces racing to enqueue one participant cannot create two FIFO entries.
 const joins=await Promise.all(Array.from({length:6},(_,n)=>concurrent(`select set_config('request.jwt.claim.sub',fw(${n%2?4:9})::text,false);set role authenticated;
 select set_panel_family_booking(fw(104),fw(407),fw(507),'join',array[fw(904)],${n%2?'false':'true'},'it')->>'status';`)));
 assert.ok(joins.every(x=>/queued/.test(x)));
 assert.equal(psql(`select count(*) from panel_waitlist where registration_id=fw(104) and panel_id=fw(407) and status='waiting';`,true).trim(),'1');
 psql(`select set_config('request.jwt.claim.sub',fw(9)::text,false);select set_group_panel_waitlist(fw(200),fw(507),fw(105),'join');
 select set_group_panel_booking(fw(200),fw(508),fw(104),true);
 update panel_seat_sections set capacity=app.registration_panel_party_size(fw(104),fw(407)) where id=fw(507);
 update panel_waitlist set notification_status='sent' where panel_id<>fw(407) and status='offered';
 update panel_waitlist_scheduler set next_run_at=clock_timestamp();`);
 const claims=await Promise.all(Array.from({length:6},()=>concurrent(`set role service_role;select claim_panel_waitlist_notification()->>'id';`)));
 const ids=claims.flatMap(x=>x.match(/[a-f0-9]{8}-[a-f0-9-]{27}/g)??[]);assert.equal(ids.length,1);
 const accepts=await Promise.all(Array.from({length:6},(_,n)=>concurrent(`select set_config('request.jwt.claim.sub',fw(${n%2?4:9})::text,false);set role authenticated;
 select ${n%2?"set_individual_panel_waitlist(fw(104),fw(407),fw(507),'accept')":"set_group_panel_waitlist(fw(200),fw(507),fw(104),'accept')"}->>'status';`)));
 assert.ok(accepts.every(x=>/booked/.test(x)));
 assert.equal(psql(`select count(*) from moment_attendance_choices where registration_id=fw(104) and moment_id=fw(407) and choice='yes';`,true).trim(),'1');
 assert.equal(psql(`select choice from moment_attendance_choices where registration_id=fw(104) and moment_id=fw(408);`,true).trim(),'no');
 console.log('PASS six concurrent personal/leader joins share one FIFO entry, six workers claim once, six mixed acceptances swap and book once');
}
