-- Entire fixture rolls back; exact production UUIDs refer to synthetic local rows only.
begin;
update events set is_current=false;
insert into events(id,slug,title,city,country,starts_on,ends_on,status,is_current,panel_access_mode)
 values('d302dff4-f08d-4040-8d83-9ec2042a73d5','relay-synthetic','Relay synthetic','Assisi','IT','2026-10-25','2026-10-27','published',true,'open');
insert into auth.users(id,email) select fw(7000+n),'relay-'||n||'@example.invalid' from generate_series(1,8) n;
insert into profiles(id,email) select id,email from auth.users where id in (select fw(7000+n) from generate_series(1,8) n);
insert into participants(id,auth_user_id,first_name,last_name,public_code,country_other)
 select fw(7100+n),fw(7000+n),'Relay','Synthetic '||n,'RLY'||n,'Italia' from generate_series(1,8) n;
-- Country, not language or leader: canonical IT + Ukrainian locale is eligible.
update participants set country_id=(select id from countries where iso2='IT'),country_other=null,preferred_locale='uk' where id=fw(7102);
update participants set country_other='  Italy  ' where id=fw(7103);
update participants set country_id=(select id from countries where iso2='FR'),country_other=null,preferred_locale='it' where id=fw(7106);
update participants set country_id=null,country_other=null where id=fw(7107);
update participants set country_id=(select id from countries where iso2='IT'),country_other='Francia' where id=fw(7108);
insert into registrations(id,event_id,participant_id,status)
 select fw(7200+n),'d302dff4-f08d-4040-8d83-9ec2042a73d5',fw(7100+n),'confirmed' from generate_series(1,8) n;
insert into event_attendance_choices(registration_id,day,day_part,choice)
 select fw(7200+n),d::date,part,'yes' from generate_series(1,8) n
 cross join generate_series('2026-10-26'::date,'2026-10-27'::date,interval '1 day') d cross join (values('morning'),('afternoon')) p(part);
insert into registration_children(id,registration_id,position,first_name,last_name,birth_date) values(fw(7301),fw(7202),1,'Relay child','Synthetic','2018-01-01');
insert into panel_audience_types(id,event_id,code,name,booking_channel,sort_order)
 values(fw(7400),'d302dff4-f08d-4040-8d83-9ec2042a73d5','registered','Iscritti','individual',1);
insert into event_locations(id,event_id,name,max_capacity) values(fw(7500),'d302dff4-f08d-4040-8d83-9ec2042a73d5','Original synthetic 0',200);
insert into event_moments(id,event_id,location_id,title,starts_at,ends_at,moment_type,publication_status,is_public,check_in_enabled)
 values('fc9f3085-dabf-4e2d-b01b-7ccaf1b984da','d302dff4-f08d-4040-8d83-9ec2042a73d5',fw(7500),'FORUM 1 - Synthetic content','2026-10-26 09:00 Europe/Rome','2026-10-26 11:00 Europe/Rome','panel','draft',false,true);
insert into panel_seat_sections(id,event_id,panel_id,audience_type_id,capacity) values(fw(7600),'d302dff4-f08d-4040-8d83-9ec2042a73d5','fc9f3085-dabf-4e2d-b01b-7ccaf1b984da',fw(7400),1);
update event_moments set publication_status='published',is_public=true where id='fc9f3085-dabf-4e2d-b01b-7ccaf1b984da';
insert into event_locations(id,event_id,name,max_capacity) values(fw(7501),'d302dff4-f08d-4040-8d83-9ec2042a73d5','Original synthetic 1',200);
insert into event_moments(id,event_id,location_id,title,starts_at,ends_at,moment_type,publication_status,is_public,check_in_enabled)
 values('2eb7bdd0-72b3-4c94-9db2-064be7d37caa','d302dff4-f08d-4040-8d83-9ec2042a73d5',fw(7501),'FORUM 3 - Synthetic content','2026-10-26 09:00 Europe/Rome','2026-10-26 11:00 Europe/Rome','panel','draft',false,true);
insert into panel_seat_sections(id,event_id,panel_id,audience_type_id,capacity) values(fw(7601),'d302dff4-f08d-4040-8d83-9ec2042a73d5','2eb7bdd0-72b3-4c94-9db2-064be7d37caa',fw(7400),20);
update event_moments set publication_status='published',is_public=true where id='2eb7bdd0-72b3-4c94-9db2-064be7d37caa';
insert into event_locations(id,event_id,name,max_capacity) values(fw(7502),'d302dff4-f08d-4040-8d83-9ec2042a73d5','Original synthetic 2',200);
insert into event_moments(id,event_id,location_id,title,starts_at,ends_at,moment_type,publication_status,is_public,check_in_enabled)
 values('e8d77bc5-1559-4fc9-bea8-1e8d84f8ab0f','d302dff4-f08d-4040-8d83-9ec2042a73d5',fw(7502),'FORUM 9 - Synthetic content','2026-10-26 16:00 Europe/Rome','2026-10-26 18:00 Europe/Rome','panel','draft',false,true);
insert into panel_seat_sections(id,event_id,panel_id,audience_type_id,capacity) values(fw(7602),'d302dff4-f08d-4040-8d83-9ec2042a73d5','e8d77bc5-1559-4fc9-bea8-1e8d84f8ab0f',fw(7400),20);
update event_moments set publication_status='published',is_public=true where id='e8d77bc5-1559-4fc9-bea8-1e8d84f8ab0f';
insert into event_locations(id,event_id,name,max_capacity) values(fw(7503),'d302dff4-f08d-4040-8d83-9ec2042a73d5','Original synthetic 3',200);
insert into event_moments(id,event_id,location_id,title,starts_at,ends_at,moment_type,publication_status,is_public,check_in_enabled)
 values('db14374f-3297-4aab-b325-4b4a5506a8dc','d302dff4-f08d-4040-8d83-9ec2042a73d5',fw(7503),'FORUM 10 - Synthetic content','2026-10-26 16:00 Europe/Rome','2026-10-26 18:00 Europe/Rome','panel','draft',false,true);
insert into panel_seat_sections(id,event_id,panel_id,audience_type_id,capacity) values(fw(7603),'d302dff4-f08d-4040-8d83-9ec2042a73d5','db14374f-3297-4aab-b325-4b4a5506a8dc',fw(7400),20);
update event_moments set publication_status='published',is_public=true where id='db14374f-3297-4aab-b325-4b4a5506a8dc';
insert into event_locations(id,event_id,name,max_capacity) values(fw(7504),'d302dff4-f08d-4040-8d83-9ec2042a73d5','Original synthetic 4',200);
insert into event_moments(id,event_id,location_id,title,starts_at,ends_at,moment_type,publication_status,is_public,check_in_enabled)
 values('20aa5c45-1e8c-4f8d-a757-cb1b0624e959','d302dff4-f08d-4040-8d83-9ec2042a73d5',fw(7504),'FORUM 18 - Synthetic content','2026-10-27 09:00 Europe/Rome','2026-10-27 11:00 Europe/Rome','panel','draft',false,true);
insert into panel_seat_sections(id,event_id,panel_id,audience_type_id,capacity) values(fw(7604),'d302dff4-f08d-4040-8d83-9ec2042a73d5','20aa5c45-1e8c-4f8d-a757-cb1b0624e959',fw(7400),20);
update event_moments set publication_status='published',is_public=true where id='20aa5c45-1e8c-4f8d-a757-cb1b0624e959';
insert into event_locations(id,event_id,name,max_capacity) values(fw(7505),'d302dff4-f08d-4040-8d83-9ec2042a73d5','Original synthetic 5',200);
insert into event_moments(id,event_id,location_id,title,starts_at,ends_at,moment_type,publication_status,is_public,check_in_enabled)
 values('fbfd9fbe-aebc-4438-8b88-a4e379e00e3c','d302dff4-f08d-4040-8d83-9ec2042a73d5',fw(7505),'FORUM 19 - Synthetic content','2026-10-27 09:00 Europe/Rome','2026-10-27 11:00 Europe/Rome','panel','draft',false,true);
insert into panel_seat_sections(id,event_id,panel_id,audience_type_id,capacity) values(fw(7605),'d302dff4-f08d-4040-8d83-9ec2042a73d5','fbfd9fbe-aebc-4438-8b88-a4e379e00e3c',fw(7400),20);
update event_moments set publication_status='published',is_public=true where id='fbfd9fbe-aebc-4438-8b88-a4e379e00e3c';
\i supabase/migrations/20261023101000_assisi_relay_programme.sql
set constraints all immediate;
do $$ begin
 assert (select count(*)=6 from panel_relay_rooms);
 assert (select sum(s.capacity)=798 from panel_seat_sections s join panel_relay_rooms r on r.panel_id=s.panel_id);
 assert not exists(select 1 from event_moments p join panel_relay_rooms r on r.panel_id=p.id where p.title not like '%SALA COLLEGATA — SOLO IN ITALIANO%');
 assert (select count(*)=2 from event_locations where event_id='d302dff4-f08d-4040-8d83-9ec2042a73d5' and city='Assisi');
 assert (select address='Viale Giovanni XXIII 2' from event_locations where id='04cec46a-0d84-4927-8403-109d061a8afd');
 assert (select address='Viale Guglielmo Marconi 6' from event_locations where id='41c0d31c-68cc-44f3-b271-26e3245ab40c');
 assert not exists(select 1 from event_moments p join panel_relay_rooms r on r.panel_id=p.id where p.description not like '%navetta Linea C%' or lower(p.description) not like '%parcheggio%');
end $$;
\echo PASS six real programme mappings, 798 seats, titles, Italian-only description and supplied addresses/transport
savepoint extend_existing;
insert into panel_waitlist(event_id,registration_id,panel_id,section_id,notification_user_id,status,offered_at,expires_at,reserved_seats,notification_status)
 select 'd302dff4-f08d-4040-8d83-9ec2042a73d5',fw(7200+n),'fbfd9fbe-aebc-4438-8b88-a4e379e00e3c',fw(7605),fw(7000+n),'offered',
  clock_timestamp()-interval '30 minutes',clock_timestamp()+case n when 5 then interval '30 minutes' when 6 then interval '-1 minute' else interval '3 hours' end,1,'sent'
 from generate_series(5,7) n;
create temp table old_deadlines as select * from panel_waitlist;
\i supabase/migrations/20261023102000_forum_waitlist_extend_active_offers.sql
\i supabase/migrations/20261023102000_forum_waitlist_extend_active_offers.sql
do $$ begin
 assert (select expires_at=offered_at+interval '2 hours' from panel_waitlist where registration_id=fw(7205));
 assert not exists(select 1 from panel_waitlist q join old_deadlines old using(id) where q.registration_id<>fw(7205) and q.expires_at<>old.expires_at);
 assert not exists(select 1 from panel_waitlist q join old_deadlines old using(id) where (to_jsonb(q)-'expires_at')<>(to_jsonb(old)-'expires_at'));
 assert (select count(*)=1 from audit_logs where action='panel.waitlist_window_extended' and event_id='d302dff4-f08d-4040-8d83-9ec2042a73d5');
end $$;
rollback to extend_existing;
\echo PASS existing live offers extended without restart/revival/shortening/resend; migration retry does not duplicate audit
select set_config('request.jwt.claim.sub',fw(7001)::text,true);
select set_panel_family_booking(fw(7201),'fc9f3085-dabf-4e2d-b01b-7ccaf1b984da',fw(7600),'book','{}');
select set_config('request.jwt.claim.sub',fw(7002)::text,true);
select set_panel_family_booking(fw(7202),'2eb7bdd0-72b3-4c94-9db2-064be7d37caa',fw(7601),'book','{}');
select set_panel_family_booking(fw(7202),'fc9f3085-dabf-4e2d-b01b-7ccaf1b984da',fw(7600),'join',array[fw(7301)]);
select set_config('request.jwt.claim.sub',fw(7003)::text,true);
select set_panel_family_booking(fw(7203),'fc9f3085-dabf-4e2d-b01b-7ccaf1b984da',fw(7600),'join','{}');
select set_config('request.jwt.claim.sub',fw(7004)::text,true);
select set_panel_family_booking(fw(7204),'fc9f3085-dabf-4e2d-b01b-7ccaf1b984da',fw(7600),'join','{}');
savepoint residence_filter;
select set_config('request.jwt.claim.sub',fw(7006)::text,true);
select set_panel_family_booking(fw(7206),'fc9f3085-dabf-4e2d-b01b-7ccaf1b984da',fw(7600),'join','{}');
select set_config('request.jwt.claim.sub',fw(7007)::text,true);
select set_panel_family_booking(fw(7207),'fc9f3085-dabf-4e2d-b01b-7ccaf1b984da',fw(7600),'join','{}');
select set_config('request.jwt.claim.sub',fw(7008)::text,true);
select set_panel_family_booking(fw(7208),'fc9f3085-dabf-4e2d-b01b-7ccaf1b984da',fw(7600),'join','{}');
create temp table residence_original_queue as select * from panel_waitlist;
select activate_panel_relay_rooms('d302dff4-f08d-4040-8d83-9ec2042a73d5');
do $$ begin
 assert (select count(*)=3 from panel_waitlist where source_waitlist_id is not null);
 assert (select array_agg(registration_id order by sequence) from panel_waitlist where source_waitlist_id is not null)=array[fw(7202),fw(7203),fw(7204)];
 assert not exists((select * from panel_waitlist where source_waitlist_id is null except select * from residence_original_queue) union all (select * from residence_original_queue except select * from panel_waitlist where source_waitlist_id is null));
end $$;
select app.advance_panel_waitlist('3e30d388-2fdc-401d-a8e0-40a582b70a9a',true);
-- Residence changed after promotion, before claim: no mail or new reservation.
update participants set country_other='Francia' where id=fw(7102);
update panel_waitlist_scheduler set next_run_at=clock_timestamp()+interval '1 day';
do $$ declare notice jsonb; begin
 notice:=claim_panel_waitlist_notification();
 assert notice->>'registrationId'=fw(7203)::text;
 assert (select status='cancelled' from panel_waitlist where source_waitlist_id is not null and registration_id=fw(7202));
 assert (select status='waiting' from panel_waitlist where panel_id='fc9f3085-dabf-4e2d-b01b-7ccaf1b984da' and registration_id=fw(7202));
 assert (notice->>'expiresAt')::timestamptz-clock_timestamp() between interval '119 minutes' and interval '2 hours';
end $$;
rollback to residence_filter;
\echo PASS Italy residence only (canonical/text), no nationality or language inference, unknown/foreign excluded, original queues unchanged and recheck at claim
savepoint source_offer;
update panel_seat_sections set capacity=3 where id=fw(7600);
select app.advance_panel_waitlist(fw(7600),true);
select activate_panel_relay_rooms('d302dff4-f08d-4040-8d83-9ec2042a73d5');
select app.advance_panel_waitlist('3e30d388-2fdc-401d-a8e0-40a582b70a9a',true);
do $$ begin
 assert (select status='waiting' from panel_waitlist where panel_id='dbcee5e7-c080-42b5-a2d3-d54f485b5706' and registration_id=fw(7202));
 assert not exists(select 1 from panel_waitlist where panel_id='dbcee5e7-c080-42b5-a2d3-d54f485b5706' and status='offered');
end $$;
select set_config('request.jwt.claim.sub',fw(7002)::text,true);
select set_panel_family_booking(fw(7202),'fc9f3085-dabf-4e2d-b01b-7ccaf1b984da',fw(7600),'accept',array[fw(7301)]);
select app.advance_panel_waitlist('3e30d388-2fdc-401d-a8e0-40a582b70a9a',true);
do $$ begin
 assert (select status='cancelled' from panel_waitlist where panel_id='dbcee5e7-c080-42b5-a2d3-d54f485b5706' and registration_id=fw(7202));
 assert (select status='offered' from panel_waitlist where panel_id='dbcee5e7-c080-42b5-a2d3-d54f485b5706' and registration_id=fw(7203));
end $$;
rollback to source_offer;
\echo PASS an existing main-room offer keeps its response window; main acceptance cancels the redundant relay invitation
create temp table relay_original_queue as select * from panel_waitlist where panel_id='fc9f3085-dabf-4e2d-b01b-7ccaf1b984da';
set role authenticated;
do $$ begin
 begin perform activate_panel_relay_rooms('d302dff4-f08d-4040-8d83-9ec2042a73d5'); raise exception 'participant activation allowed';exception when insufficient_privilege then null;end;
 begin perform 1 from panel_relay_rooms;raise exception 'raw relay config exposed';exception when insufficient_privilege then null;end;
end $$;
reset role;
set role service_role;
select activate_panel_relay_rooms('d302dff4-f08d-4040-8d83-9ec2042a73d5');
do $$ begin assert activate_panel_relay_rooms('d302dff4-f08d-4040-8d83-9ec2042a73d5')='{"rooms":0,"invitations":0}'::jsonb;end $$;
reset role;
do $$ begin
 assert not exists((select * from panel_waitlist where panel_id='fc9f3085-dabf-4e2d-b01b-7ccaf1b984da' except select * from relay_original_queue) union all (select * from relay_original_queue except select * from panel_waitlist where panel_id='fc9f3085-dabf-4e2d-b01b-7ccaf1b984da'));
 assert (select array_agg(registration_id order by sequence) from panel_waitlist where panel_id='dbcee5e7-c080-42b5-a2d3-d54f485b5706')=array[fw(7202),fw(7203),fw(7204)];
 assert app.panel_child_ids(fw(7202),'dbcee5e7-c080-42b5-a2d3-d54f485b5706')=array[fw(7301)];
 assert (select phase='open' from panel_relay_rooms where panel_id='ef811c92-8ab6-478f-bd1d-296046ac5eb8');
 assert (select availability='priority' and remaining_seats=0 from get_public_panel_program_with_seats() where panel_id='dbcee5e7-c080-42b5-a2d3-d54f485b5706');
end $$;
\echo PASS service-only idempotent snapshot preserves exact source queue, child selection, FIFO and opens empty queues
select set_config('request.jwt.claim.sub',fw(7005)::text,true);
set role authenticated;
do $$ begin
 assert (select booking_status='priority' from get_participant_panel_catalog(fw(7205)) where panel_id='dbcee5e7-c080-42b5-a2d3-d54f485b5706');
 begin perform set_panel_family_booking(fw(7205),'dbcee5e7-c080-42b5-a2d3-d54f485b5706','3e30d388-2fdc-401d-a8e0-40a582b70a9a','book','{}');raise exception 'priority bypass';exception when sqlstate '22023' or sqlstate 'P0001' then null;end;
 begin perform set_panel_family_booking(fw(7205),'dbcee5e7-c080-42b5-a2d3-d54f485b5706','3e30d388-2fdc-401d-a8e0-40a582b70a9a','join','{}');raise exception 'joined priority';exception when sqlstate '22023' then null;end;
end $$;
reset role;
update panel_seat_sections set capacity=2 where id='3e30d388-2fdc-401d-a8e0-40a582b70a9a';
select app.advance_panel_waitlist('3e30d388-2fdc-401d-a8e0-40a582b70a9a',true);
do $$ begin
 assert (select expires_at-offered_at between interval '2 hours' and interval '2 hours 1 second' from panel_waitlist where panel_id='dbcee5e7-c080-42b5-a2d3-d54f485b5706' and registration_id=fw(7202));
 assert (select reserved_seats=2 and status='offered' from panel_waitlist where panel_id='dbcee5e7-c080-42b5-a2d3-d54f485b5706' and registration_id=fw(7202));
 assert (select count(*)=2 from panel_waitlist where panel_id='dbcee5e7-c080-42b5-a2d3-d54f485b5706' and status='waiting');
 assert app.panel_section_occupancy('3e30d388-2fdc-401d-a8e0-40a582b70a9a')=2;
end $$;
savepoint all_offered;
update panel_waitlist set status='cancelled' where panel_id='dbcee5e7-c080-42b5-a2d3-d54f485b5706' and status='waiting';
update panel_seat_sections set capacity=3 where id='3e30d388-2fdc-401d-a8e0-40a582b70a9a';
select set_config('request.jwt.claim.sub',fw(7005)::text,true);
do $$ begin
 begin perform set_panel_family_booking(fw(7205),'dbcee5e7-c080-42b5-a2d3-d54f485b5706','3e30d388-2fdc-401d-a8e0-40a582b70a9a','book','{}');raise exception 'stole residual priority seat';exception when sqlstate '22023' then null;end;
 begin insert into moment_attendance_choices(registration_id,moment_id,choice,seat_section_id) values(fw(7205),'dbcee5e7-c080-42b5-a2d3-d54f485b5706','yes','3e30d388-2fdc-401d-a8e0-40a582b70a9a');raise exception 'operational writer bypass';exception when sqlstate '22023' then null;end;
end $$;
rollback to all_offered;
\echo PASS priority blocks ordinary and operational booking even with residual seats and no waiting rows
select set_config('request.jwt.claim.sub',fw(7002)::text,true);
set role authenticated;
select set_panel_family_booking(fw(7202),'dbcee5e7-c080-42b5-a2d3-d54f485b5706','3e30d388-2fdc-401d-a8e0-40a582b70a9a','accept',array[fw(7301)]);
select set_panel_family_booking(fw(7202),'dbcee5e7-c080-42b5-a2d3-d54f485b5706','3e30d388-2fdc-401d-a8e0-40a582b70a9a','accept',array[fw(7301)]);
reset role;
do $$ begin
 assert (select choice='no' from moment_attendance_choices where registration_id=fw(7202) and moment_id='2eb7bdd0-72b3-4c94-9db2-064be7d37caa');
 assert (select choice='yes' from moment_attendance_choices where registration_id=fw(7202) and moment_id='dbcee5e7-c080-42b5-a2d3-d54f485b5706');
 assert (select status='waiting' from panel_waitlist where registration_id=fw(7202) and panel_id='fc9f3085-dabf-4e2d-b01b-7ccaf1b984da');
 assert not exists((select * from panel_waitlist where panel_id='fc9f3085-dabf-4e2d-b01b-7ccaf1b984da' except select * from relay_original_queue) union all (select * from relay_original_queue except select * from panel_waitlist where panel_id='fc9f3085-dabf-4e2d-b01b-7ccaf1b984da'));
end $$;
\echo PASS priority enforced on participant/direct paths; full family reserved; acceptance swaps third Forum and preserves exact original queue
update panel_seat_sections set capacity=3 where id=fw(7600);
select app.advance_panel_waitlist(fw(7600),true);
select set_config('request.jwt.claim.sub',fw(7002)::text,true);
select set_panel_family_booking(fw(7202),'fc9f3085-dabf-4e2d-b01b-7ccaf1b984da',fw(7600),'accept',array[fw(7301)]);
do $$ begin
 assert (select choice='no' from moment_attendance_choices where registration_id=fw(7202) and moment_id='dbcee5e7-c080-42b5-a2d3-d54f485b5706');
 assert (select choice='yes' from moment_attendance_choices where registration_id=fw(7202) and moment_id='fc9f3085-dabf-4e2d-b01b-7ccaf1b984da');
 assert app.panel_section_occupancy('3e30d388-2fdc-401d-a8e0-40a582b70a9a')=0;
end $$;
select app.advance_panel_waitlist('3e30d388-2fdc-401d-a8e0-40a582b70a9a',true);
select set_config('request.jwt.claim.sub',fw(7003)::text,true);
select set_panel_family_booking(fw(7203),'dbcee5e7-c080-42b5-a2d3-d54f485b5706','3e30d388-2fdc-401d-a8e0-40a582b70a9a','leave','{}');
update panel_waitlist set expires_at=clock_timestamp()-interval '1 second' where panel_id='dbcee5e7-c080-42b5-a2d3-d54f485b5706' and registration_id=fw(7204);
select app.advance_panel_waitlist('3e30d388-2fdc-401d-a8e0-40a582b70a9a',true);
do $$ begin
 assert (select status='waiting' from panel_waitlist where panel_id='fc9f3085-dabf-4e2d-b01b-7ccaf1b984da' and registration_id=fw(7203));
 assert (select status='waiting' from panel_waitlist where panel_id='fc9f3085-dabf-4e2d-b01b-7ccaf1b984da' and registration_id=fw(7204));
 assert (select phase='open' from panel_relay_rooms where panel_id='dbcee5e7-c080-42b5-a2d3-d54f485b5706');
end $$;
select set_config('request.jwt.claim.sub',fw(7005)::text,true);
select set_panel_family_booking(fw(7205),'dbcee5e7-c080-42b5-a2d3-d54f485b5706','3e30d388-2fdc-401d-a8e0-40a582b70a9a','book','{}');
\echo PASS upgrade frees relay seat, decline/expiry preserve main queue, and residual seats open after priority
rollback;
