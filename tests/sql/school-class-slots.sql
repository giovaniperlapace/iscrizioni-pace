-- Only run in the disposable school-direct-link harness. All cases roll back.
begin;
update panel_seat_sections set capacity=100 where id=sd(501);
insert into event_locations(id,event_id,name,max_capacity) values(sd(306),sd(100),'Sala 6',100),(sd(307),sd(100),'Sala 7',100),(sd(308),sd(100),'Sala 8',100);
insert into event_moments(id,event_id,moment_type,title,starts_at,ends_at,location_id,publication_status,is_public)
select sd(400+n),sd(100),'panel','Forum scuola '||n,
  case when n=6 then '2026-10-26 09:30+01' when n=7 then '2026-10-26 13:00+01' else '2026-10-26 08:00+01' end::timestamptz,
  case when n=6 then '2026-10-26 12:30+01' when n=7 then '2026-10-26 16:00+01' else '2026-10-26 09:00+01' end::timestamptz,
  sd(300+n),'draft',false from generate_series(6,8) n;
insert into panel_seat_sections(id,event_id,panel_id,audience_type_id,capacity)
select sd(500+n),sd(100),sd(400+n),sd(200),100 from generate_series(6,8) n;
update event_moments set publication_status='published',is_public=true where id in(sd(406),sd(407),sd(408));
create function public.sc_create(class_name text,panel integer,students integer default 5,companions integer default 1,school text default 'Scuola vincoli',email text default 'school-3@example.invalid')
returns uuid language sql as $$
 select public.create_public_school_booking(sd(100),email,'Ada','Docente','+3906000000',school,'Roma',class_name,students,companions,'school-booking-v1',
 jsonb_build_array(jsonb_build_object('panel_id',sd(400+panel),'seat_section_id',sd(500+panel),'student_count',students,'companion_count',companions)),
 encode(extensions.digest(gen_random_uuid()::text,'sha256'),'hex'),'synthetic-encrypted-token-value');
$$;
select sc_create('3A',1);
select sc_create('3B',6);
select sc_create('3A',7); -- same class, afternoon
select sc_create('3A',2); -- same class, different day
select sc_create('3A',6,5,1,'Altra scuola');
select sc_create('3A',6,5,1,'Scuola vincoli','other@example.invalid');
do $$ declare b uuid; before_count integer;begin
 select count(*) into before_count from school_bookings;
 begin perform sc_create(' 3 - a ',6,4,2,' SCUOLA VINCOLI ');raise exception 'same class evaded using spacing and counts';exception when exclusion_violation then null;end;
 begin perform sc_create('3A',1);raise exception 'duplicate same forum allowed';exception when exclusion_violation then null;end;
 begin perform sc_create('3A',8);raise exception 'nonoverlapping morning allowed';exception when exclusion_violation then null;end;
 assert (select count(*)=before_count from school_bookings);
 assert (select count(*)=6 from app.school_class_reservations);
 -- Renaming a separate class cannot silently create a duplicate.
 begin
  update school_bookings set class_description='3 A' where school_name='Scuola vincoli' and class_description='3B';
  set constraints all immediate;
  raise exception 'class rename bypassed constraints';
 exception when unique_violation or exclusion_violation then null;end;
 set constraints all deferred;
 -- Moving an afternoon panel into a reserved morning is rejected.
 begin
  update event_moments set starts_at='2026-10-26 11:00+01',ends_at='2026-10-26 12:00+01' where id=sd(407);
  set constraints all immediate;
  raise exception 'schedule change bypassed constraints';
 exception when unique_violation or exclusion_violation then null;end;
 set constraints all deferred;
 -- Actual overlap remains prohibited even across the noon slot boundary.
 begin
  update event_moments set starts_at='2026-10-26 12:00+01' where id=sd(407);
  set constraints all immediate;
  raise exception 'cross-noon overlap allowed';
 exception when unique_violation or exclusion_violation then null;end;
 set constraints all deferred;
end $$;
\echo PASS different classes/schools/teachers and different slots allowed; duplicate class, counts, spelling, identity and timetable changes protected
select set_config('request.jwt.claim.sub',sd(3)::text,true);
select set_config('request.jwt.claims','{"email":"school-3@example.invalid"}',true);
set local role authenticated;
select link_current_school_teacher_identity();
do $$ declare b uuid;begin
 select id into b from school_bookings where school_name='Scuola vincoli' and class_description='3A'
 and exists(select 1 from school_panel_reservations r where r.booking_id=school_bookings.id and panel_id=sd(401));
 -- Replacement, not accumulation: a valid atomic move to another morning forum.
 perform save_school_booking(sd(100),b,'school-3@example.invalid','Ada','Docente','+3906000000','Scuola vincoli','Roma','3A',5,1,'school-booking-v1',null,'submitted',
 jsonb_build_array(jsonb_build_object('panel_id',sd(406),'seat_section_id',sd(506),'student_count',5,'companion_count',1)));
 assert (select count(*)=1 from school_panel_reservations where booking_id=b and status='reserved');
 -- A later invalid modification preserves the last saved booking.
 begin
 perform save_school_booking(sd(100),b,'school-3@example.invalid','Ada','Docente','+3906000000','Scuola vincoli','Roma','3A',5,1,'school-booking-v1',null,'submitted',
 jsonb_build_array(jsonb_build_object('panel_id',sd(407),'seat_section_id',sd(507),'student_count',5,'companion_count',1)));
 raise exception 'update across bookings allowed';exception when exclusion_violation then null;end;
 assert exists(select 1 from school_panel_reservations where booking_id=b and panel_id=sd(406) and status='reserved');
 perform cancel_school_booking(b);
end $$;
reset role;
select sc_create('3A',1); -- cancellation releases the class's slot
set constraints all immediate;
do $$ begin
 assert not has_table_privilege('anon','app.school_class_reservations','select');
 assert not has_table_privilege('authenticated','app.school_class_reservations','select');
 assert not has_function_privilege('authenticated','app.sync_school_class_reservation(uuid)','execute');
 assert get_panel_release_mode()='internal';
 assert (select count(*)=0 from get_public_panel_program());
 assert (select count(*)=6 from app.school_class_reservations);
end $$;
\echo PASS teacher atomic replacement, failed edit rollback, cancellation/rebooking, private projection and closed personal/home access
rollback;
