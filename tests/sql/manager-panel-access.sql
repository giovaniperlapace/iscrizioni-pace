-- ONLY disposable PostgreSQL with all canonical migrations already applied.
-- Synthetic fixture, rolled back completely. Never run this file in production.
begin;
create function public.release_fixture_id(n integer) returns uuid language sql immutable
as $$ select md5('panel-release-' || n::text)::uuid $$;
create function public.release_expect_denied(command text) returns void language plpgsql as $$
begin
  begin execute command;
  exception when insufficient_privilege then return;
  end;
  raise exception 'Expected access denial: %', command;
end $$;

grant usage on schema public, app, extensions to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
insert into auth.users(id,email) select release_fixture_id(n), 'release-' || n || '@example.invalid' from generate_series(1,7) n;
insert into public.profiles(id,email,full_name) select release_fixture_id(n), 'release-' || n || '@example.invalid','Synthetic ' || n from generate_series(1,7) n;
update public.events set is_current = false where is_current;
update public.events set slug = slug || '-previous' where slug = 'assisi-2026-test';
insert into public.events(id,slug,title,city,country,status,is_current,starts_on,ends_on)
values(release_fixture_id(100),'assisi-2026-test','Synthetic panel release','Test','IT','published',true,'2026-10-25','2026-10-27');
insert into public.event_user_roles(user_id,event_id,role) values
(release_fixture_id(1),null,'admin'),
(release_fixture_id(2),release_fixture_id(100),'manager'),
(release_fixture_id(3),release_fixture_id(100),'manager_viewer');
\ir ../../supabase/seeds/panel-p1-staging.sql
insert into public.participants(id,auth_user_id,first_name,last_name) values(release_fixture_id(20),release_fixture_id(4),'Synthetic','Participant');
insert into public.registrations(id,event_id,participant_id,status) values(release_fixture_id(30),release_fixture_id(100),release_fixture_id(20),'confirmed');
insert into public.registration_children(registration_id,first_name,last_name,birth_date,position) values(release_fixture_id(30),'Synthetic','Child','2018-01-01',1);

-- Keep selected identifiers accessible to test roles, including hidden panels.
create temporary table release_context as select
 release_fixture_id(100) as event_id, p.id as panel_id,
 (select s.id from panel_seat_sections s join panel_audience_types a on a.id=s.audience_type_id where s.panel_id=p.id and a.booking_channel='individual') as individual_section,
 (select s.id from panel_seat_sections s join panel_audience_types a on a.id=s.audience_type_id where s.panel_id=p.id and a.booking_channel='school_booking') as school_section
from event_moments p where p.title='Pace e giovani';
grant select on release_context to anon,authenticated,service_role;

set local role anon;
do $$ begin
 assert public.get_panel_release_mode()='internal';
 assert (select count(*)=0 from public.get_public_panel_program());
 assert (select count(*)=0 from public.get_public_school_booking_options());
 assert (select count(*)=0 from public.event_moments where moment_type='panel');
 assert (select count(*)=0 from public.event_locations);
 perform release_expect_denied('select * from public.panel_seat_sections');
end $$;
reset role;
select set_config('request.jwt.claim.sub',release_fixture_id(4)::text,true);
set local role authenticated;
do $$ begin
 assert (select count(*)=0 from public.get_participant_panel_catalog(release_fixture_id(30)));
 perform release_expect_denied(format('select public.set_individual_panel_booking(%L,%L,%L,true)',release_fixture_id(30),(select panel_id from release_context),(select individual_section from release_context)));
 perform release_expect_denied(format('select public.book_group_panel(%L,%L,array[%L]::uuid[])',(select event_id from release_context),(select individual_section from release_context),release_fixture_id(30)));
 perform release_expect_denied(format('select public.set_group_panel_booking(%L,%L,%L,true)',(select event_id from release_context),(select individual_section from release_context),release_fixture_id(30)));
 perform release_expect_denied(format('select * from public.get_panel_seat_availability(%L)',(select event_id from release_context)));
 update public.events set panel_access_mode='open' where is_current;
 assert public.get_panel_release_mode()='internal';
end $$;
reset role;

-- Admin school booking remains usable. Manager access is enabled below.
select set_config('request.jwt.claim.sub',release_fixture_id(1)::text,true);
set local role authenticated;
do $$ declare c record; booking_id uuid; begin
 select * into c from release_context;
 assert (select count(*)=3 from public.event_moments where moment_type='panel');
 booking_id:=public.save_school_booking(c.event_id,null,'release-5@example.invalid','Synthetic','Teacher','+3900000000','Synthetic school','Test','Class',2,1,'school-booking-v1',null,'confirmed',
 jsonb_build_array(jsonb_build_object('panel_id',c.panel_id,'seat_section_id',c.school_section,'student_count',2,'companion_count',1)),
 encode(extensions.digest('synthetic-release','sha256'),'hex'),'synthetic-encrypted');
 assert booking_id is not null;
 assert (select occupied=3 from public.get_panel_seat_availability(c.event_id) where section_id=c.school_section);
end $$;
reset role;
select set_config('request.jwt.claim.sub',release_fixture_id(3)::text,true);
set local role authenticated;
do $$ begin
 perform release_expect_denied(format('select * from public.get_panel_seat_availability(%L)',(select event_id from release_context)));
 assert (select count(*)=0 from public.event_moments where moment_type='panel');
 assert (select count(*)=0 from public.school_bookings);
 perform release_expect_denied(format('select public.cancel_school_booking(%L)',release_fixture_id(200)));
end $$;
reset role;

-- Explicit table grants emulate Supabase defaults; RLS must still deny the new audiences.
grant select, insert, update, delete on public.email_campaigns, public.email_campaign_recipients to authenticated;
-- Both campaigns exist as real rows only inside this rolled-back fixture.
insert into public.email_campaigns(id,event_id,name,subject_template,body_template,filters_snapshot,created_by)
values(release_fixture_id(201),release_fixture_id(100),'Synthetic general','Subject','Body','{}',release_fixture_id(1)),
(release_fixture_id(202),release_fixture_id(100),'Synthetic private','Subject','Body','{"audience":"teachers"}',release_fixture_id(1));
create temporary table release_teacher as select id from school_booking_teachers where email='release-5@example.invalid';
grant select on release_teacher to authenticated;

-- Manager of the current event uses the accepted admin tools while internal.
insert into public.events(id,slug,title,city,country,status,is_current,starts_on,ends_on)
values(release_fixture_id(101),'synthetic-other-event','Other synthetic event','Test','IT','published',false,'2026-10-25','2026-10-27');
insert into public.event_user_roles(user_id,event_id,role) values
(release_fixture_id(6),release_fixture_id(101),'manager'),
(release_fixture_id(3),release_fixture_id(101),'manager');
select set_config('request.jwt.claim.sub',release_fixture_id(2)::text,true);
set local role authenticated;
do $$ declare c record; location_id uuid; draft_id uuid; booking_id uuid; sections jsonb; begin
 select * into c from release_context;
 assert app.panel_management_allowed(c.event_id);
 assert not app.panel_management_allowed(release_fixture_id(101));
 assert (select count(*)=3 from public.event_moments where moment_type='panel');
 assert (select count(*)>0 from public.event_locations);
 assert (select count(*)>0 from public.panel_seat_sections);
 assert (select count(*)>0 from public.panel_audience_types);
 assert (select count(*)=1 from public.school_bookings);
 assert (select count(*)=1 from public.school_booking_qr_tokens);
 assert (select occupied=3 from public.get_panel_seat_availability(c.event_id) where section_id=c.school_section);
 insert into public.event_locations(event_id,name,max_capacity) values(c.event_id,'Manager synthetic location',100) returning id into location_id;
 select jsonb_build_array(jsonb_build_object('audience_type_id',audience_type_id,'capacity',20)) into sections from public.panel_seat_sections where id=c.individual_section;
 draft_id:=public.save_panel_draft(c.event_id,null,'Manager synthetic panel',null,location_id,'2026-10-26 09:30+01','2026-10-26 12:30+01',sections);
 assert draft_id is not null;
 perform public.publish_panels(c.event_id,array[draft_id]);
 perform public.save_published_panel(c.event_id,draft_id,'Manager synthetic panel edited',null,location_id,'2026-10-26 09:30+01','2026-10-26 12:30+01',sections);
 assert (select title='Manager synthetic panel edited' from public.event_moments where id=draft_id);
 booking_id:=public.save_school_booking(c.event_id,null,'manager-teacher@example.invalid','Synthetic','Teacher','+3900000000','Manager school','Test','Class',2,1,'school-booking-v1',null,'confirmed',
 jsonb_build_array(jsonb_build_object('panel_id',c.panel_id,'seat_section_id',c.school_section,'student_count',2,'companion_count',1)),null,null);
 assert booking_id is not null;
 assert (select occupied=6 from public.get_panel_seat_availability(c.event_id) where section_id=c.school_section);
 perform public.cancel_school_booking(booking_id);
 assert (select occupied=3 from public.get_panel_seat_availability(c.event_id) where section_id=c.school_section);
 assert (select count(*)=2 from public.email_campaigns);
 insert into public.email_campaigns(event_id,name,subject_template,body_template,filters_snapshot,created_by)
 values(c.event_id,'Manager school audience','Subject','Body','{"audience":"teachers"}',release_fixture_id(2));
 update public.email_campaigns set filters_snapshot='{"panelId":"synthetic"}' where id=release_fixture_id(201);
 insert into public.email_campaign_recipients(campaign_id,recipient_key,recipient_type,school_teacher_id,delivery_kind)
 values(release_fixture_id(202),'teacher:synthetic','teacher',(select id from release_teacher),'teacher');
 assert (select count(*)=1 from public.email_campaign_recipients where campaign_id=release_fixture_id(202));
 update public.email_campaign_recipients set recipient_key='teacher:updated' where campaign_id=release_fixture_id(202);
 delete from public.email_campaign_recipients where campaign_id=release_fixture_id(202);
 update public.events set panel_access_mode='open' where is_current;
 assert public.get_panel_release_mode()='internal';
 assert (select count(*)=0 from public.get_public_panel_program());
end $$;
reset role;

-- Foreign manager and cumulative viewer+foreign-manager stay excluded.
select set_config('request.jwt.claim.sub',release_fixture_id(6)::text,true);
set local role authenticated;
do $$ begin
 assert not app.panel_management_allowed(release_fixture_id(100));
 assert not app.panel_management_allowed(release_fixture_id(101));
 assert (select count(*)=0 from public.event_moments where moment_type='panel');
 assert (select count(*)=0 from public.school_bookings);
 assert (select count(*)=0 from public.email_campaigns);
 perform release_expect_denied(format('select public.publish_panels(%L,array[%L]::uuid[])',(select event_id from release_context),(select panel_id from release_context)));
end $$;
reset role;
select set_config('request.jwt.claim.sub',release_fixture_id(3)::text,true);
set local role authenticated;
do $$ begin
 assert not app.panel_management_allowed(release_fixture_id(100));
 assert (select count(*)=0 from public.event_moments where moment_type='panel');
 assert (select count(*)=0 from public.school_bookings);
 assert (select count(*)=0 from public.email_campaigns);
 perform release_expect_denied(format('select public.publish_panels(%L,array[%L]::uuid[])',(select event_id from release_context),(select panel_id from release_context)));
end $$;
reset role;

-- Even service-only public submission obeys the switch, before writing teachers/QRs.
select set_config('request.jwt.claim.sub','',true);
set local role service_role;
do $$ begin
 perform release_expect_denied(format('select public.create_public_school_booking(%L,null,null,null,null,null,null,null,1,1,null,''[]''::jsonb,null,null)',(select event_id from release_context)));
end $$;
reset role;
select set_config('request.jwt.claim.sub',release_fixture_id(5)::text,true);
select set_config('request.jwt.claims','{"email":"release-5@example.invalid"}',true);
set local role authenticated;
do $$ begin
 assert (select count(*)=0 from public.school_bookings);
 assert (select count(*)=0 from public.school_booking_teachers);
 assert (select count(*)=0 from public.school_panel_reservations);
 assert (select count(*)=0 from public.school_booking_qr_tokens);
end $$;
reset role;

-- Catalog mode exposes the preserved program, but still rejects bookings.
update events set panel_access_mode='catalog' where is_current;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$ begin
 assert public.get_panel_release_mode()='catalog';
 assert (select count(*)=4 from public.get_public_panel_program());
 assert (select count(*)=0 from public.get_public_school_booking_options());
end $$;
reset role;
select set_config('request.jwt.claim.sub',release_fixture_id(4)::text,true);
set local role authenticated;
do $$ begin
 perform release_expect_denied(format('select public.set_individual_panel_booking(%L,%L,%L,true)',release_fixture_id(30),(select panel_id from release_context),(select individual_section from release_context)));
end $$;
reset role;

-- Future opening keeps existing transactions, counts children and never overbooks.
update events set panel_access_mode='open' where is_current;
set local role authenticated;
select public.set_individual_panel_booking(release_fixture_id(30),panel_id,individual_section,true) from release_context;
select public.set_individual_panel_booking(release_fixture_id(30),panel_id,individual_section,true) from release_context;
reset role;
select set_config('request.jwt.claim.sub',release_fixture_id(1)::text,true);
set local role authenticated;
do $$ begin
 assert (select occupied=2 from public.get_panel_seat_availability((select event_id from release_context)) where section_id=(select individual_section from release_context));
end $$;
reset role;
update events set panel_access_mode='internal' where is_current;
set local role anon;
do $$ begin assert (select count(*)=0 from public.get_public_panel_program()); end $$;
reset role;
select set_config('request.jwt.claim.sub',release_fixture_id(2)::text,true);
set local role authenticated;
do $$ begin
 assert (select count(*)=1 from public.moment_attendance_choices where moment_id=(select panel_id from release_context));
 assert (select count(*)=0 from public.get_public_panel_program());
 assert public.get_panel_release_mode()='internal';
end $$;
reset role;
select 'PASS: internal/catalog/open, direct RPC/RLS, admin schools; current manager management, foreign manager, cumulative viewer, teacher, service role, child occupancy and retry';
rollback;
