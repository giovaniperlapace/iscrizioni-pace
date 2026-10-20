-- Original RPCs and direct writes, using disposable fw() fixtures only.
begin;
update panel_waitlist set status='cancelled' where registration_id=fw(106);
delete from moment_attendance_choices where registration_id=fw(106);
delete from event_attendance_choices where registration_id=fw(106);
select set_config('request.jwt.claim.sub',fw(6)::text,true);
set local role authenticated;
do $$ begin
 begin perform set_panel_family_booking(fw(106),fw(403),fw(503),'book',array[]::uuid[]);raise exception 'missing attendance allowed';exception when sqlstate 'PFA01' then null;end;
 begin perform set_individual_panel_booking(fw(106),fw(403),fw(503),true);raise exception 'legacy RPC bypass';exception when sqlstate 'PFA01' then null;end;
end $$;
reset role;
insert into event_attendance_choices(registration_id,day,day_part,choice) values(fw(106),'2026-10-26','afternoon','yes');
do $$ begin
 begin perform set_panel_family_booking(fw(106),fw(403),fw(503),'book',array[]::uuid[]);raise exception 'wrong half day allowed';exception when sqlstate 'PFA01' then null;end;
end $$;
insert into event_attendance_choices(registration_id,day,day_part,choice) values(fw(106),'2026-10-26',null,'yes'),(fw(106),'2026-10-26','morning','no');
do $$ begin
 begin perform set_panel_family_booking(fw(106),fw(403),fw(503),'book',array[]::uuid[]);raise exception 'explicit no overridden by legacy yes';exception when sqlstate 'PFA01' then null;end;
end $$;
delete from event_attendance_choices where registration_id=fw(106) and day_part='morning';
-- Legacy all-day yes qualifies, then cancellation remains possible after attendance removal.
select set_panel_family_booking(fw(106),fw(403),fw(503),'book',array[]::uuid[]);
delete from event_attendance_choices where registration_id=fw(106);
select set_panel_family_booking(fw(106),fw(403),fw(503),'cancel',array[]::uuid[]);
insert into event_attendance_choices(registration_id,day,day_part,choice) values(fw(106),'2026-10-26','morning','yes');
insert into event_attendance_choices(registration_id,choice) values(fw(106),'unknown');
do $$ begin
 begin perform set_panel_family_booking(fw(106),fw(403),fw(503),'book',array[]::uuid[]);raise exception 'unknown allowed';exception when sqlstate 'PFA01' then null;end;
end $$;
delete from event_attendance_choices where registration_id=fw(106) and choice='unknown';
select set_panel_family_booking(fw(106),fw(403),fw(503),'book',array[]::uuid[]);
do $$ begin assert (select choice='yes' from moment_attendance_choices where registration_id=fw(106) and moment_id=fw(403));end $$;
-- Direct inserts cannot bypass the guard. Other day is not covered.
do $$ begin
 begin insert into moment_attendance_choices(registration_id,moment_id,choice,seat_section_id) values(fw(106),fw(405),'yes',fw(505));raise exception 'direct write bypass';exception when sqlstate 'PFA01' then null;end;
 begin perform set_panel_family_booking(fw(106),fw(405),fw(505),'join',array[]::uuid[]);raise exception 'queue bypass';exception when sqlstate 'PFA01' then null;end;
 assert app.panel_slot_key('2026-10-26 11:59 Europe/Rome')='2026-10-26:morning';
 assert app.panel_slot_key('2026-10-26 12:00 Europe/Rome')='2026-10-26:afternoon';
end $$;

-- Leader route uses the participant's attendance, never the leader's.
insert into groups(id,event_id,name) values(fw(799),fw(200),'Attendance test');
insert into group_memberships(group_id,user_id) values(fw(799),fw(9));
insert into participant_group_assignments(registration_id,group_id,status,is_current) values(fw(106),fw(799),'confirmed',true);
select set_config('request.jwt.claim.sub',fw(9)::text,true);
do $$ begin
 begin perform set_panel_family_booking(fw(106),fw(405),fw(505),'book',array[]::uuid[],true);raise exception 'leader bypass';exception when sqlstate 'PFA01' then null;end;
end $$;
-- Full Forum: join only after attendance update, recheck at acceptance, preserve offer on failure.
update panel_waitlist set status='cancelled' where section_id=fw(505);
delete from moment_attendance_choices where moment_id=fw(405);
update panel_seat_sections set capacity=1 where id=fw(505);
select set_config('request.jwt.claim.sub',fw(1)::text,true);
select set_panel_family_booking(fw(101),fw(405),fw(505),'book',array[]::uuid[]);
select set_config('request.jwt.claim.sub',fw(6)::text,true);
insert into event_attendance_choices(registration_id,day,day_part,choice) values(fw(106),'2026-10-27','afternoon','yes');
select set_panel_family_booking(fw(106),fw(405),fw(505),'join',array[]::uuid[]);
select set_config('request.jwt.claim.sub',fw(1)::text,true);
select set_panel_family_booking(fw(101),fw(405),fw(505),'cancel',array[]::uuid[]);
select app.advance_panel_waitlist(fw(505),true);
select set_config('request.jwt.claim.sub',fw(6)::text,true);
delete from event_attendance_choices where registration_id=fw(106) and day='2026-10-27';
do $$ begin
 begin perform set_panel_family_booking(fw(106),fw(405),fw(505),'accept',array[]::uuid[]);raise exception 'accept bypass';exception when sqlstate 'PFA01' then null;end;
 assert exists(select 1 from panel_waitlist where registration_id=fw(106) and panel_id=fw(405) and status='offered');
 begin perform set_individual_panel_waitlist(fw(106),fw(405),fw(505),'accept');raise exception 'legacy accept bypass';exception when sqlstate 'PFA01' then null;end;
 assert exists(select 1 from panel_waitlist where registration_id=fw(106) and panel_id=fw(405) and status='offered');
end $$;
insert into event_attendance_choices(registration_id,day,day_part,choice) values(fw(106),'2026-10-27','afternoon','yes');
select set_panel_family_booking(fw(106),fw(405),fw(505),'accept',array[]::uuid[]);
do $$ begin assert exists(select 1 from moment_attendance_choices where registration_id=fw(106) and moment_id=fw(405) and choice='yes');end $$;
rollback;
\echo PASS attendance missing/no/unknown, exact day/half-day, legacy day, direct and legacy RPC protection, save then book, cancellation
