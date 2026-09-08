-- Disposable empty PostgreSQL database only. Apply original policies then restriction.
create schema app;
create schema auth;
create role authenticated;
create type public.app_role as enum ('admin','manager','manager_viewer','capogruppo');
create function public.f(n int) returns uuid language sql immutable as $$ select md5(n::text)::uuid $$;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
create table events(id uuid primary key, is_current boolean);
create table participants(id uuid primary key, auth_user_id uuid);
create table registrations(id uuid primary key, participant_id uuid, event_id uuid);
create table groups(id uuid primary key, event_id uuid);
create table group_memberships(group_id uuid,user_id uuid,role text);
create table participant_group_assignments(registration_id uuid,group_id uuid,is_current boolean,status text);
create table event_user_roles(user_id uuid,event_id uuid,role public.app_role);
create function app.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create function app.has_event_role(e uuid, roles public.app_role[]) returns boolean language sql stable security definer as $$
 select exists(select 1 from event_user_roles where user_id=auth.uid() and (role='admin' or (event_id=e and role=any(roles)))) $$;
create function app.is_group_leader(g uuid) returns boolean language sql stable security definer as $$
 select exists(select 1 from group_memberships where group_id=g and user_id=auth.uid() and role='capogruppo') $$;
create function app.owns_registration(r uuid) returns boolean language sql stable security definer as $$
 select exists(select 1 from registrations join participants on participants.id=participant_id where registrations.id=r and auth_user_id=auth.uid()) $$;
create function app.can_read_participant(p uuid) returns boolean language sql stable security definer as $$
 select exists(select 1 from registrations where participant_id=p and app.has_event_role(event_id,array['manager','manager_viewer']::app_role[])) $$;
\ir ../../supabase/migrations/20260711100000_event_services.sql
insert into events values(f(1),true),(f(2),false);
insert into participants values(f(10),f(10)),(f(11),f(11));
insert into registrations values(f(10),f(10),f(1)),(f(11),f(11),f(1));
insert into groups values(f(20),f(1));
insert into group_memberships values(f(20),f(30),'capogruppo');
insert into participant_group_assignments values(f(10),f(20),true,'confirmed'),(f(11),f(20),true,'confirmed');
insert into event_user_roles values(f(31),f(1),'manager'),(f(32),f(2),'manager'),(f(33),null,'admin'),(f(34),f(1),'manager_viewer');
insert into event_services(id,event_id,label) values(f(40),f(1),'Fixture');
insert into participant_event_services(event_id,registration_id,participant_id,service_id,source) values(f(1),f(10),f(10),f(40),'capogruppo');
\ir ../../supabase/migrations/20260908180000_leader_service_read_only.sql

grant usage on schema public,app,auth to authenticated;
grant select,insert,update,delete on all tables in schema public to authenticated;
set role authenticated;
select set_config('test.uid',f(30)::text,false);
do $$ declare n int; begin
 assert (select count(*)=1 from participant_event_services), 'leader lost read access';
 update participant_event_services set operator_note='forbidden';
 get diagnostics n=row_count; assert n=0, 'leader updated service';
 delete from participant_event_services;
 get diagnostics n=row_count; assert n=0, 'leader deleted service';
 begin
  insert into participant_event_services(event_id,registration_id,participant_id,service_id,source) values(f(1),f(11),f(11),f(40),'manager');
  raise exception 'leader inserted service';
 exception when insufficient_privilege then null; end;
end $$;
-- Manager in another event and viewer cannot write.
do $$ declare u int; n int; begin
 foreach u in array array[32,34] loop
 perform set_config('test.uid',f(u)::text,false);
 update participant_event_services set operator_note='forbidden';
 get diagnostics n=row_count; assert n=0, 'out-of-scope/viewer write';
 end loop;
end $$;
-- Managers and global admins retain update, insert and delete, including old sources.
do $$ declare u int; n int; begin
 foreach u in array array[31,33] loop
 perform set_config('test.uid',f(u)::text,false);
 update participant_event_services set operator_note='allowed';
 get diagnostics n=row_count; assert n=1, 'manager/admin update denied';
 insert into participant_event_services(event_id,registration_id,participant_id,service_id) values(f(1),f(11),f(11),f(40));
 delete from participant_event_services where participant_id=f(11);
 get diagnostics n=row_count; assert n=1, 'manager/admin delete denied';
 end loop;
end $$;
-- Personal preference remains a separate capability for one's own registration.
select set_config('test.uid',f(11)::text,false);
insert into participant_event_services(event_id,registration_id,participant_id,service_id,source,status) values(f(1),f(11),f(11),f(40),'participant_preference','preference_pending');
reset role;
select 'PASS leader read-only, manager/admin writes, viewer/event isolation, own preference';
