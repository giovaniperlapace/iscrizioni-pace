-- Synthetic fixtures only; run-forum-waitlist.mjs supplies a disposable local cluster.
create function public.fw(n integer) returns uuid language sql immutable as $$ select md5('forum-queue-'||n)::uuid $$;
grant usage on schema public,app,extensions to anon,authenticated,service_role;
insert into auth.users(id,email) select fw(n),'queue-'||n||'@example.invalid' from generate_series(1,12) n;
insert into profiles(id,email) select id,email from auth.users;
update events set is_current=false;
insert into events(id,slug,title,city,country,starts_on,ends_on,status,is_current,panel_access_mode)
 values(fw(200),'forum-queue-test','Synthetic Forum queue','Test','IT','2026-10-25','2026-10-27','published',true,'open');
insert into event_user_roles(event_id,user_id,role) values(null,fw(10),'admin'),(fw(200),fw(11),'manager'),(fw(200),fw(12),'manager_viewer');
insert into participants(id,auth_user_id,first_name,last_name,public_code)
 select fw(20+n),fw(n),'Synthetic '||n,'Queue',lpad(n::text,4,'Q') from generate_series(1,9) n;
insert into registrations(id,event_id,participant_id,status) select fw(100+n),fw(200),fw(20+n),'confirmed' from generate_series(1,9) n;
insert into event_attendance_choices(registration_id,day,day_part,choice)
 select fw(100+n),d::date,part,'yes' from generate_series(1,9) n
 cross join generate_series('2026-10-25'::date,'2026-10-27'::date,interval '1 day') d
 cross join (values('morning'),('afternoon')) parts(part);
insert into panel_audience_types(id,event_id,code,name,booking_channel,sort_order) values
 (fw(300),fw(200),'individual','Individual','individual',1),(fw(301),fw(200),'schools','Schools','school_booking',2);
begin;
insert into event_locations(id,event_id,name,max_capacity) select fw(600+n),fw(200),'Room '||n,50 from generate_series(1,6) n;
insert into event_moments(id,event_id,moment_type,title,starts_at,ends_at,location_id,publication_status,is_public)
 values(fw(401),fw(200),'panel','Forum full','2026-10-26 16:00 Europe/Rome','2026-10-26 17:00 Europe/Rome',fw(601),'draft',false),
 (fw(402),fw(200),'panel','Forum 17','2026-10-26 17:00 Europe/Rome','2026-10-26 18:00 Europe/Rome',fw(602),'draft',false),
 (fw(403),fw(200),'panel','Morning A','2026-10-26 09:00 Europe/Rome','2026-10-26 10:00 Europe/Rome',fw(603),'draft',false),
 (fw(404),fw(200),'panel','Morning B','2026-10-26 11:00 Europe/Rome','2026-10-26 12:00 Europe/Rome',fw(604),'draft',false),
 (fw(405),fw(200),'panel','Other day','2026-10-27 16:00 Europe/Rome','2026-10-27 17:00 Europe/Rome',fw(605),'draft',false),
 (fw(406),fw(200),'panel','Concurrent last seat','2026-10-27 09:00 Europe/Rome','2026-10-27 10:00 Europe/Rome',fw(606),'draft',false);
insert into panel_seat_sections(id,event_id,panel_id,audience_type_id,capacity)
 select fw(500+n),fw(200),fw(400+n),fw(300),case when n in (1,6) then 1 else 10 end from generate_series(1,6) n;
insert into panel_seat_sections(id,event_id,panel_id,audience_type_id,capacity) values(fw(550),fw(200),fw(401),fw(301),25);
update event_moments set publication_status='published',is_public=true where event_id=fw(200);
commit;
select set_config('request.jwt.claim.sub',fw(1)::text,false);
set role authenticated;
select set_individual_panel_booking(fw(101),fw(401),fw(501),true);
do $$ begin
 begin perform set_individual_panel_booking(fw(101),fw(402),fw(502),true);raise exception '17 did not block 16';exception when exclusion_violation then null;end;
 perform set_individual_panel_booking(fw(101),fw(403),fw(503),true);
 begin perform set_individual_panel_booking(fw(101),fw(404),fw(504),true);raise exception 'nonoverlapping morning allowed';exception when exclusion_violation then null;end;
 perform set_individual_panel_booking(fw(101),fw(405),fw(505),true);
end $$;
reset role;
\echo PASS morning/afternoon slots, 16/17 conflict, separate days
select set_config('request.jwt.claim.sub',fw(2)::text,false);
set role authenticated;
select set_individual_panel_booking(fw(102),fw(402),fw(502),true);
select set_individual_panel_waitlist(fw(102),fw(401),fw(501),'join');
select set_individual_panel_waitlist(fw(102),fw(401),fw(501),'join');
do $$ begin
 assert (select booking_status='queued' and queue_position=1 from get_participant_panel_catalog(fw(102)) where section_id=fw(501));
 begin perform set_individual_panel_waitlist(fw(103),fw(401),fw(501),'join');raise exception 'foreign registration allowed';exception when insufficient_privilege then null;end;
 begin perform claim_panel_waitlist_notification();raise exception 'worker RPC exposed';exception when insufficient_privilege then null;end;
 begin perform 1 from panel_waitlist;raise exception 'queue identities exposed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',fw(3)::text,false);
set role authenticated;
select set_individual_panel_waitlist(fw(103),fw(401),fw(501),'join');
reset role;
\echo PASS queue coexists with another same-slot booking, idempotence and ownership/RLS
select set_config('request.jwt.claim.sub',fw(1)::text,false);
set role authenticated;
select set_individual_panel_booking(fw(101),fw(401),fw(501),false);
reset role;
do $$ begin assert (select count(*)=0 from panel_waitlist where status='offered');end $$;
begin;
select app.advance_panel_waitlist(fw(501),true);
do $$ begin
 assert (select expires_at-offered_at between interval '2 hours' and interval '2 hours 1 second'
   from panel_waitlist where registration_id=fw(102) and status='offered');
end $$;
rollback;
set role service_role;
select claim_panel_waitlist_notification();
reset role;
do $$ begin
 assert (select expires_at-offered_at between interval '2 hours' and interval '2 hours 1 second'
   from panel_waitlist where registration_id=fw(102) and status='offered');
end $$;
\echo PASS two-hour reservation both on promotion and notification claim

do $$ begin
 assert (select status='offered' and notification_status='sending' from panel_waitlist where registration_id=fw(102));
 assert (select status='waiting' from panel_waitlist where registration_id=fw(103));
 assert (select app.panel_section_occupancy(fw(501))=1);
 assert (select next_run_at > clock_timestamp()+interval '4 minutes' from panel_waitlist_scheduler);
end $$;
\echo PASS withdrawal waits for scheduler, FIFO first only, durable five-minute cadence, held seats unavailable
select set_config('request.jwt.claim.sub',fw(4)::text,false);
set role authenticated;
do $$ begin
 begin perform set_individual_panel_booking(fw(104),fw(401),fw(501),true);raise exception 'stolen held seat';exception when sqlstate 'P0001' then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',fw(2)::text,false);
set role authenticated;
select set_individual_panel_waitlist(fw(102),fw(401),fw(501),'accept');
select set_individual_panel_waitlist(fw(102),fw(401),fw(501),'accept');
reset role;
do $$ begin
 assert (select choice='no' and seat_section_id is null from moment_attendance_choices where registration_id=fw(102) and moment_id=fw(402));
 assert (select choice='yes' from moment_attendance_choices where registration_id=fw(102) and moment_id=fw(401));
 assert (select count(*)=1 from audit_logs where entity_id=(select id from panel_waitlist where registration_id=fw(102)) and action='panel.waitlist_accepted');
end $$;
\echo PASS explicit acceptance swaps the canonical booking atomically and retry is idempotent
-- Five seats added by transferring part of the unused school quota.
select set_config('request.jwt.claim.sub',fw(3)::text,false);
set role authenticated;
select set_individual_panel_booking(fw(103),fw(402),fw(502),true);
reset role;
do $$ declare n integer; begin
 for n in 4..8 loop
  perform set_config('request.jwt.claim.sub',fw(n)::text,false);
  perform set_individual_panel_waitlist(fw(100+n),fw(401),fw(501),'join');
 end loop;
end $$;
begin;
update panel_seat_sections set capacity=20 where id=fw(550);
update panel_seat_sections set capacity=6 where id=fw(501);
commit;
do $$ begin assert (select count(*)=0 from panel_waitlist where status='offered');end $$;
update panel_waitlist_scheduler set next_run_at=clock_timestamp();
set role service_role;
select claim_panel_waitlist_notification();
reset role;
do $$ begin
 assert (select count(*)=5 from panel_waitlist where status='offered');
 assert (select status='waiting' from panel_waitlist where registration_id=fw(108));
 assert (select app.panel_section_occupancy(fw(501))=6);
 begin
  update panel_seat_sections set capacity=5 where id=fw(501);
  set constraints all immediate;
  raise exception 'capacity reduction stole an offer';
 exception when sqlstate 'P0001' then null;
 end;
end $$;
\echo PASS quota reallocation offers exactly first five and protects reserved capacity
-- Provider outcome is durable, including an ambiguous response; never send again.
set role service_role;
select finish_panel_waitlist_notification(id,notification_claim,'unknown') from panel_waitlist where notification_status='sending';
select claim_panel_waitlist_notification();
select claim_panel_waitlist_notification();
select claim_panel_waitlist_notification();
select claim_panel_waitlist_notification();
do $$ begin assert claim_panel_waitlist_notification() is null;end $$;
reset role;
\echo PASS durable send claims and unknown outcomes are never blindly retried
-- Exact expiration is checked even before the next five-minute sweep.
update panel_waitlist set expires_at=clock_timestamp()-interval '1 second' where registration_id=fw(103) and status='offered';
select set_config('request.jwt.claim.sub',fw(3)::text,false);
set role authenticated;
do $$ begin
 assert set_individual_panel_waitlist(fw(103),fw(401),fw(501),'accept')->>'status'='expired';
 assert (select choice='yes' from moment_attendance_choices where registration_id=fw(103) and moment_id=fw(402));
end $$;
reset role;
do $$ begin assert (select status='waiting' from panel_waitlist where registration_id=fw(108));end $$;
update panel_waitlist_scheduler set next_run_at=clock_timestamp();
set role service_role;
select claim_panel_waitlist_notification();
reset role;
do $$ begin
 assert (select status='offered' from panel_waitlist where registration_id=fw(108));
 assert (select status='expired' from panel_waitlist where registration_id=fw(103));
end $$;
\echo PASS expiry advances to the new head; old booking remains valid without acceptance
-- Surplus capacity is publicly bookable once all waiting entries have a reservation.
update panel_seat_sections set capacity=8 where id=fw(501);
select set_config('request.jwt.claim.sub',fw(9)::text,false);
set role authenticated;
do $$ begin assert (select booking_status='available' from get_participant_panel_catalog(fw(109)) where section_id=fw(501));end $$;
reset role;
\echo PASS excess seats restore ordinary booking while existing offers remain reserved
-- Family at the head cannot be skipped for a smaller party.
select set_config('request.jwt.claim.sub',fw(4)::text,false);
select set_individual_panel_waitlist(fw(104),fw(401),fw(501),'leave');
insert into registration_children(registration_id,position,first_name,last_name,birth_date) values(fw(104),1,'Synthetic','Child','2018-01-01');
update panel_seat_sections set capacity=2 where id=fw(505);
select set_config('request.jwt.claim.sub',fw(4)::text,false);
select set_panel_family_booking(fw(104),fw(405),fw(505),'join',array(select id from registration_children where registration_id=fw(104)));
select set_config('request.jwt.claim.sub',fw(5)::text,false);
select set_individual_panel_waitlist(fw(105),fw(405),fw(505),'join');
update panel_waitlist_scheduler set next_run_at=clock_timestamp();
set role service_role;
select claim_panel_waitlist_notification();
reset role;
do $$ begin assert (select count(*)=2 from panel_waitlist where section_id=fw(505) and status='waiting');end $$;
select set_config('request.jwt.claim.sub',fw(6)::text,false);
set role authenticated;
do $$ begin
 begin perform set_individual_panel_booking(fw(106),fw(405),fw(505),true);raise exception 'FIFO bypass';exception when sqlstate 'P0001' then null;end;
end $$;
reset role;
do $$ begin
 begin insert into moment_attendance_choices(registration_id,moment_id,choice,seat_section_id) values(fw(106),fw(405),'yes',fw(505));
  raise exception 'direct writer bypassed FIFO';exception when sqlstate 'P0001' then null;end;
end $$;
update panel_seat_sections set capacity=3 where id=fw(505);
update panel_waitlist_scheduler set next_run_at=clock_timestamp();
set role service_role;
select claim_panel_waitlist_notification();
reset role;
do $$ begin assert (select status='offered' and reserved_seats=2 from panel_waitlist where registration_id=fw(104) and section_id=fw(505));end $$;
-- Family edits cannot invalidate already reserved seats.
do $$ begin
 begin
  delete from registration_children where registration_id=fw(104);
  set constraints all immediate;
  raise exception 'reserved family size changed';
 exception when invalid_parameter_value then null;
 end;
end $$;
\echo PASS family reservation counts all seats, strict FIFO, offered family-size guard
-- Closing the event cancels offers and the owner and worker cannot bypass the opening gate.
update events set panel_access_mode='internal' where id=fw(200);
select set_config('request.jwt.claim.sub',fw(9)::text,false);
set role authenticated;
do $$ begin
 assert (select count(*)=0 from get_participant_panel_catalog(fw(109)));
 begin perform set_individual_panel_waitlist(fw(109),fw(401),fw(501),'join');raise exception 'closed gate bypass';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ begin assert (select count(*)=0 from panel_waitlist where status='offered');end $$;
update events set panel_access_mode='open' where id=fw(200);
-- Empty queue: expiration restores ordinary booking rather than retaining a ghost hold.
select set_config('request.jwt.claim.sub',fw(1)::text,false);
select set_individual_panel_booking(fw(101),fw(406),fw(506),true);
select set_config('request.jwt.claim.sub',fw(9)::text,false);
select set_individual_panel_waitlist(fw(109),fw(406),fw(506),'join');
select set_config('request.jwt.claim.sub',fw(1)::text,false);
select set_individual_panel_booking(fw(101),fw(406),fw(506),false);
update panel_waitlist_scheduler set next_run_at=clock_timestamp();
select claim_panel_waitlist_notification();
update panel_waitlist set expires_at=clock_timestamp()-interval '1 second' where registration_id=fw(109) and panel_id=fw(406) and status='offered';
select set_config('request.jwt.claim.sub',fw(6)::text,false);
set role authenticated;
do $$ begin
 assert (select booking_status='available' from get_participant_panel_catalog(fw(106)) where section_id=fw(506));
 assert (select availability='available' from get_public_panel_program() where panel_id=fw(406));
end $$;
reset role;
select set_config('request.jwt.claim.sub',fw(9)::text,false);
do $$ begin assert set_individual_panel_waitlist(fw(109),fw(406),fw(506),'accept')->>'status'='expired';end $$;
-- Queue scope is also protected against accidental service-side inserts.
do $$ begin
 begin insert into panel_waitlist(event_id,registration_id,panel_id,section_id,notification_user_id)
  values(fw(200),fw(103),fw(401),fw(503),fw(3));raise exception 'queue section scope bypass';
 exception when check_violation then null;end;
end $$;
\echo PASS empty queue expiry restores ordinary/public availability and DB scope is enforced
-- Return the concurrency fixture to one occupied seat and no active queue.
update panel_waitlist set status='cancelled' where status in ('waiting','offered');
delete from registration_children where registration_id=fw(104);
update panel_seat_sections set capacity=1 where id=fw(501);
select set_config('request.jwt.claim.sub',fw(3)::text,false);
select set_individual_panel_waitlist(fw(103),fw(401),fw(501),'join');
\echo PASS closure preserves the public gate and cancels outstanding reservations
