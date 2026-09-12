-- Disposable local database only; minimal schema follows the production types.
create role anon;
create role authenticated;
create role service_role;
create function f(n int) returns uuid language sql immutable as $$ select md5(n::text)::uuid $$;
create table events(id uuid primary key, is_current boolean, starts_on date, ends_on date);
create table registrations(id uuid primary key, event_id uuid, deleted_at timestamptz);
create table groups(id uuid primary key,event_id uuid,parent_group_id uuid,is_active boolean);
create table group_memberships(group_id uuid,user_id uuid,role text);
create table participant_group_assignments(id uuid primary key,registration_id uuid,group_id uuid,is_current boolean);
create table event_attendance_choices(registration_id uuid,day date,day_part text check(day_part in ('morning','afternoon')),choice text check(choice in ('yes','no','unknown')));
create table audit_logs(event_id uuid,actor_user_id uuid,action text,entity_table text,entity_id uuid,metadata jsonb);
\ir ../../supabase/migrations/20260910120000_leader_attendance.sql
insert into events values(f(1),true,'2026-10-25','2026-10-27'),(f(2),false,'2026-10-25','2026-10-27');
insert into registrations values(f(10),f(1),null),(f(11),f(2),null),(f(12),f(1),now());
insert into groups values(f(20),f(1),null,true),(f(21),f(1),f(20),true),(f(22),f(1),null,true),(f(23),f(2),f(20),true),(f(24),f(1),f(20),false);
insert into group_memberships values(f(20),f(30),'capogruppo'),(f(22),f(31),'capogruppo'),(f(20),f(32),'manager_viewer');
insert into participant_group_assignments values(f(40),f(10),f(21),true),(f(41),f(11),f(23),true),(f(42),f(12),f(21),true),(f(43),f(10),f(21),false),(f(44),f(10),f(24),true);
grant usage on schema public to service_role,authenticated,anon;
grant select,insert,update,delete on all tables in schema public to service_role;
set role service_role;
select update_group_leader_attendance(f(40),f(30),false,'[{"day":"2026-10-24","part":"afternoon"},{"day":"2026-10-25","part":"morning"},{"day":"2026-10-25","part":"morning"}]');
do $$ begin
 assert (select count(*)=2 from event_attendance_choices), 'deduplicated days not persisted';
 assert (select count(*)=1 from audit_logs), 'missing audit';
end $$;
-- Denied actor, unrelated leader, viewer, inactive/deleted/foreign assignment.
do $$ declare actor int; assignment int; begin
 foreach actor in array array[31,32,33] loop
  begin
   perform update_group_leader_attendance(f(40),f(actor),true,'[]'); raise exception 'scope bypass';
  exception when insufficient_privilege then null; end;
 end loop;
 foreach assignment in array array[41,42,43,44,45] loop
  begin
   perform update_group_leader_attendance(f(assignment),f(30),true,'[]'); raise exception 'assignment bypass';
  exception when insufficient_privilege then null; end;
 end loop;
 assert (select count(*)=2 from event_attendance_choices), 'denial changed data';
end $$;
-- Invalid payloads leave prior selection and audit unchanged.
do $$ declare payload jsonb; begin
 foreach payload in array array['[]'::jsonb,'null','{}','[{"day":"2026-10-24","part":"morning"}]','[{"day":"2026-10-28","part":"morning"}]','[{"day":"2026-10-25"}]','[{"day":"2026-10-25","part":"night"}]'] loop
  begin
   perform update_group_leader_attendance(f(40),f(30),false,payload); raise exception 'invalid accepted';
  exception when invalid_parameter_value then null; end;
 end loop;
 assert (select count(*)=2 from event_attendance_choices), 'validation changed data';
 assert (select count(*)=1 from audit_logs), 'validation audited';
end $$;
select update_group_leader_attendance(f(40),f(30),true,'[]');
do $$ begin assert (select count(*)=1 and min(choice)='unknown' from event_attendance_choices), 'unknown not replaced'; end $$;
reset role;
-- Force audit failure AFTER replacement and verify the complete transaction rolls back.
create function fail_audit() returns trigger language plpgsql as $$ begin raise exception 'synthetic audit failure'; end $$;
create trigger fail_audit before insert on audit_logs for each row execute function fail_audit();
set role service_role;
do $$ begin
 begin
  perform update_group_leader_attendance(f(40),f(30),false,'[{"day":"2026-10-25","part":"morning"}]');
  raise exception 'unexpected success';
 exception when raise_exception then assert sqlerrm='synthetic audit failure'; end;
 assert (select count(*)=1 and min(choice)='unknown' from event_attendance_choices), 'partial update after audit failure';
end $$;
reset role;
set role authenticated;
do $$ begin
 begin perform update_group_leader_attendance(f(40),f(30),true,'[]'); raise exception 'authenticated can forge actor';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set role anon;
do $$ begin
 begin perform update_group_leader_attendance(f(40),f(30),true,'[]'); raise exception 'anon can forge actor';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS attendance scope, validation, atomic replacement, audit and RPC grants';
