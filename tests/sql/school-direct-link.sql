-- Disposable local DB only. Never execute these synthetic cases remotely.
create function public.sd(n integer) returns uuid language sql immutable as $$ select md5('school-direct-'||n)::uuid $$;
grant usage on schema public,app,extensions to anon,authenticated,service_role;
insert into auth.users(id,email) select sd(n),'school-'||n||'@example.invalid' from generate_series(1,5) n;
insert into profiles(id,email) select id,email from auth.users;
update events set is_current=false;
insert into events(id,slug,title,city,country,starts_on,ends_on,status,is_current)
values(sd(100),'school-direct-test','Synthetic schools','Test','IT','2026-10-25','2026-10-27','published',true);
insert into event_user_roles(event_id,user_id,role) values(null,sd(1),'admin'),(sd(100),sd(2),'manager');
insert into participants(id,auth_user_id,first_name,last_name,public_code) values(sd(10),sd(4),'Synthetic','Participant','SD04');
insert into registrations(id,event_id,participant_id,status) values(sd(11),sd(100),sd(10),'confirmed');
insert into panel_audience_types(id,event_id,code,name,booking_channel,sort_order) values
(sd(200),sd(100),'schools','Scuole','school_booking',1),(sd(201),sd(100),'individual','Individual','individual',2);
begin;
insert into event_locations(id,event_id,name,max_capacity) select sd(300+n),sd(100),'Sala '||n,100 from generate_series(1,5) n;
insert into event_moments(id,event_id,moment_type,title,starts_at,ends_at,location_id,publication_status,is_public)
select sd(400+n),sd(100),'panel','Forum scuola '||n,case when n=2 then '2026-10-27 09:30+01' else '2026-10-26 09:30+01' end::timestamptz,
case when n=2 then '2026-10-27 12:30+01' else '2026-10-26 12:30+01' end::timestamptz,sd(300+n),'draft',false from generate_series(1,5) n;
insert into panel_seat_sections(id,event_id,panel_id,audience_type_id,capacity)
select sd(500+n),sd(100),sd(400+n),sd(200),case when n=3 then 0 else 25 end from generate_series(1,4) n;
insert into panel_seat_sections(id,event_id,panel_id,audience_type_id,capacity) values(sd(505),sd(100),sd(405),sd(201),25);
update event_moments set publication_status='published',is_public=true where id<>sd(404) and event_id=sd(100);
commit;
set role anon;
do $$ begin
 assert not get_school_booking_access();
 assert (select count(*)=0 from get_public_school_booking_options());
end $$;
reset role;
update events set school_link_enabled=true where id=sd(100);
set role anon;
do $$ begin
 assert get_school_booking_access(); assert get_panel_release_mode()='internal';
 assert (select count(*)=2 from get_public_school_booking_options());
 assert (select count(*)=0 from get_public_panel_program());
 assert (select count(*)=0 from event_moments where moment_type='panel');
 begin perform get_teacher_school_panel_options(sd(100));raise exception 'anon teacher metadata allowed';exception when insufficient_privilege then null;end;
 begin perform create_public_school_booking(sd(100),null,null,null,null,null,null,null,1,1,null,'[]',null,null);raise exception 'anon create allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
\echo PASS school link opens independently, excludes draft/zero/no-school sections, anon tables remain hidden
create function public.sd_create(email text,students integer,companions integer,panel integer default 1) returns uuid language sql as $$
 select public.create_public_school_booking(sd(100),email,'Ada','Docente','+3906000000','Scuola sintetica','Roma','3A',students,companions,'school-booking-v1',
 jsonb_build_array(jsonb_build_object('panel_id',sd(400+panel),'seat_section_id',sd(500+panel),'student_count',students,'companion_count',companions)),
 encode(extensions.digest(gen_random_uuid()::text,'sha256'),'hex'),'synthetic-encrypted-token-value');
$$;
grant execute on function sd_create(text,integer,integer,integer) to service_role;
set role service_role;
select count(*) from get_public_school_booking_options();
select sd_create('school-3@example.invalid',23,2);
reset role;
do $$ begin
 assert (select app.panel_section_occupancy(sd(501))=25);
 assert (select count(*)=1 from get_public_school_booking_options());
 begin perform sd_create('school-5@example.invalid',1,1);raise exception 'overbook allowed';exception when sqlstate 'P0001' then null;end;
 assert (select count(*)=0 from school_booking_teachers where email='school-5@example.invalid');
end $$;
select set_config('request.jwt.claim.sub',sd(3)::text,false);
select set_config('request.jwt.claims','{"email":"school-3@example.invalid"}',false);
set role authenticated;
select link_current_school_teacher_identity();
do $$ declare b uuid;begin
 assert (select count(*)=1 from school_bookings);
 assert (select count(*)=1 from school_booking_teachers);
 assert (select count(*)=1 from school_panel_reservations);
 assert (select count(*)=1 from school_booking_qr_tokens);
 assert exists(select 1 from get_teacher_school_panel_options(sd(100)) where section_id=sd(501));
 select id into b from school_bookings;
 perform save_school_booking(sd(100),b,'school-3@example.invalid','Ada','Docente','+3906000000','Scuola sintetica','Roma','3A',20,2,'school-booking-v1',null,'submitted',
 jsonb_build_array(jsonb_build_object('panel_id',sd(401),'seat_section_id',sd(501),'student_count',20,'companion_count',2)));
 assert (select student_count=20 from school_bookings where id=b);
end $$;
reset role;
\echo PASS service-only booking, canonical capacity, rollback when full, verified teacher reads and reduces own booking
select set_config('request.jwt.claim.sub',sd(4)::text,false);
select set_config('request.jwt.claims','{"email":"school-4@example.invalid"}',false);
set role authenticated;
do $$ begin
 assert (select count(*)=0 from school_bookings);
 assert (select count(*)=0 from school_booking_teachers);
 assert (select count(*)=0 from school_booking_qr_tokens);
 assert (select count(*)=0 from get_participant_panel_catalog(sd(11)));
 begin perform set_individual_panel_booking(sd(11),sd(405),sd(505),true);raise exception 'personal booking opened';exception when insufficient_privilege then null;end;
end $$;
reset role;
update events set school_link_enabled=false where id=sd(100);
select set_config('request.jwt.claim.sub',sd(3)::text,false);
select set_config('request.jwt.claims','{"email":"school-3@example.invalid"}',false);
set role authenticated;
do $$ begin
 assert not get_school_booking_access();
 assert (select count(*)=0 from school_bookings);
 assert (select count(*)=0 from get_teacher_school_panel_options(sd(100)));
end $$;
reset role;
set role service_role;
do $$ begin
 begin perform sd_create('school-5@example.invalid',1,1,2);raise exception 'closed link accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
update events set school_link_enabled=true where id=sd(100);
select set_config('request.jwt.claim.sub',sd(3)::text,false);
set role authenticated;
select cancel_school_booking(id) from school_bookings;
reset role;
do $$ begin
 assert (select app.panel_section_occupancy(sd(501))=0);
 assert (select count(*)=2 from get_public_school_booking_options());
 assert (select count(*)=1 from school_booking_qr_tokens where status='revoked');
end $$;
\echo PASS foreign teacher denied, personal bookings closed, link closure enforced, cancellation releases seats and revokes QR
