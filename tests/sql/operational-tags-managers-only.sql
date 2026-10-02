-- Disposable local PostgreSQL only; no real records.
create role anon; create role authenticated; create role service_role;
create schema auth; create schema app;
create type public.app_role as enum ('admin','manager','manager_viewer','capogruppo','accoglienza');
create function f(n int) returns uuid language sql immutable as $$select md5(n::text)::uuid$$;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
create table auth.users(id uuid primary key);
create table events(id uuid primary key);
create table participants(id uuid primary key);
create table registrations(id uuid primary key,participant_id uuid,event_id uuid,deleted_at timestamptz);
create table groups(id uuid primary key,event_id uuid);
create table group_memberships(group_id uuid,user_id uuid,role app_role);
create table participant_group_assignments(registration_id uuid,group_id uuid,is_current boolean);
create table event_user_roles(user_id uuid,event_id uuid,role app_role);
create function app.set_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end$$;
create function app.has_event_role(event uuid,roles app_role[]) returns boolean language sql security definer set search_path='' as $$select exists(select 1 from public.event_user_roles where user_id=auth.uid() and ((role='admin' and event_id is null) or (event_id=event and role=any(roles))))$$;
create function app.is_group_leader(g uuid) returns boolean language sql security definer as $$select exists(select 1 from group_memberships where user_id=auth.uid() and group_id=g)$$;
create function app.can_read_participant(p uuid) returns boolean language sql as $$select true$$;
\ir ../../supabase/migrations/20260626100000_operational_tags.sql
\ir ../../supabase/migrations/20261002120000_operational_tags_managers_only.sql
insert into events values(f(10)),(f(20)); insert into participants values(f(100));
insert into registrations values(f(101),f(100),f(10),null);
insert into auth.users select f(n) from generate_series(1,6) n;
insert into event_user_roles values(f(1),null,'admin'),(f(2),f(10),'manager'),(f(3),f(10),'manager_viewer'),(f(4),f(20),'manager');
insert into groups values(f(30),f(10));
insert into group_memberships values(f(30),f(5),'capogruppo');
insert into participant_group_assignments values(f(101),f(30),true);
insert into operational_tags(id,event_id,label) values(f(200),f(10),'Internal');
insert into participant_operational_tags(participant_id,tag_id) values(f(100),f(200));
grant usage on schema public,app,auth to authenticated;
grant select on all tables in schema public to authenticated;
grant insert,delete on participant_operational_tags to authenticated;
set role authenticated;
do $$ declare actor int; n int; begin
 foreach actor in array array[4,5,6] loop
  perform set_config('test.actor',f(actor)::text,false);
  assert (select count(*)=0 from operational_tags);
  assert (select count(*)=0 from participant_operational_tags);
  begin insert into participant_operational_tags values(f(100),f(200),null,now());raise exception 'write bypass';exception when insufficient_privilege then null;end;
  delete from participant_operational_tags;get diagnostics n=row_count;assert n=0;
 end loop;
 perform set_config('test.actor',f(3)::text,false);
 assert (select count(*)=1 from operational_tags);assert (select count(*)=1 from participant_operational_tags);
 delete from participant_operational_tags;get diagnostics n=row_count;assert n=0;
 foreach actor in array array[1,2] loop
  perform set_config('test.actor',f(actor)::text,false);
  assert (select count(*)=1 from participant_operational_tags);
  delete from participant_operational_tags;get diagnostics n=row_count;assert n=1;
  insert into participant_operational_tags(participant_id,tag_id) values(f(100),f(200));
 end loop;
end $$;
reset role;
select 'PASS manager/admin write, viewer read, leader/participant/foreign denied';
