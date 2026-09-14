-- Disposable local database only; minimal schema follows the production types.
create role anon;
create role authenticated;
create role service_role;
create function f(n int) returns uuid language sql immutable as $$ select md5(n::text)::uuid $$;
create table events(id uuid primary key, is_current boolean, starts_on date, ends_on date);
create table registrations(id uuid primary key, event_id uuid, deleted_at timestamptz);
create table event_attendance_choices(registration_id uuid,day date,day_part text check(day_part in ('morning','afternoon')),choice text check(choice in ('yes','no','unknown')));
create table audit_logs(event_id uuid,actor_user_id uuid,action text,entity_table text,entity_id uuid,metadata jsonb);
create table event_user_roles(user_id uuid,role text,event_id uuid);
\ir ../../supabase/migrations/20260914140000_operations_attendance.sql
insert into events values(f(1),true,'2026-10-25','2026-10-27'),(f(2),false,'2026-10-25','2026-10-27');
insert into registrations values(f(10),f(1),null),(f(11),f(2),null),(f(12),f(1),now());
insert into event_user_roles values(f(30),'manager',f(1)),(f(31),'manager',f(2)),(f(32),'manager_viewer',f(1)),(f(34),'admin',null);
grant usage on schema public to service_role,authenticated,anon;
grant select,insert,update,delete on all tables in schema public to service_role;
set role service_role;
select update_operations_attendance(f(10),f(30),false,'[{"day":"2026-10-24","part":"afternoon"},{"day":"2026-10-25","part":"morning"},{"day":"2026-10-25","part":"morning"}]');
do $$ begin
 assert (select count(*)=2 from event_attendance_choices), 'deduplicated days not persisted';
 assert (select count(*)=1 from audit_logs), 'missing audit';
end $$;
-- Denied actor, manager of another event, viewer, deleted or foreign registration.
do $$ declare actor int; registration_id int; begin
 foreach actor in array array[31,32,33] loop
  begin
   perform update_operations_attendance(f(10),f(actor),true,'[]'); raise exception 'scope bypass';
  exception when insufficient_privilege then null; end;
 end loop;
 foreach registration_id in array array[11,12,45] loop
  begin
   perform update_operations_attendance(f(registration_id),f(30),true,'[]'); raise exception 'registration bypass';
  exception when insufficient_privilege then null; end;
 end loop;
 assert (select count(*)=2 from event_attendance_choices), 'denial changed data';
end $$;
-- Invalid payloads leave prior selection and audit unchanged.
do $$ declare payload jsonb; begin
 foreach payload in array array['[]'::jsonb,'null','{}','[{"day":"2026-10-24","part":"morning"}]','[{"day":"2026-10-28","part":"morning"}]','[{"day":"2026-10-25"}]','[{"day":"2026-10-25","part":"night"}]'] loop
  begin
   perform update_operations_attendance(f(10),f(30),false,payload); raise exception 'invalid accepted';
  exception when invalid_parameter_value then null; end;
 end loop;
 assert (select count(*)=2 from event_attendance_choices), 'validation changed data';
 assert (select count(*)=1 from audit_logs), 'validation audited';
end $$;
select update_operations_attendance(f(10),f(30),true,'[]');
do $$ begin assert (select count(*)=1 and min(choice)='unknown' from event_attendance_choices), 'unknown not replaced'; end $$;
reset role;
-- Force audit failure AFTER replacement and verify the complete transaction rolls back.
create function fail_audit() returns trigger language plpgsql as $$ begin raise exception 'synthetic audit failure'; end $$;
create trigger fail_audit before insert on audit_logs for each row execute function fail_audit();
set role service_role;
do $$ begin
 begin
  perform update_operations_attendance(f(10),f(30),false,'[{"day":"2026-10-25","part":"morning"}]');
  raise exception 'unexpected success';
 exception when raise_exception then assert sqlerrm='synthetic audit failure'; end;
 assert (select count(*)=1 and min(choice)='unknown' from event_attendance_choices), 'partial update after audit failure';
end $$;
reset role;
set role authenticated;
do $$ begin
 begin perform update_operations_attendance(f(10),f(30),true,'[]'); raise exception 'authenticated can forge actor';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set role anon;
do $$ begin
 begin perform update_operations_attendance(f(10),f(30),true,'[]'); raise exception 'anon can forge actor';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
drop trigger fail_audit on audit_logs;
select update_operations_attendance(f(11),f(34),true,'[]');
select 'PASS operations attendance scope, validation, atomic replacement, audit and RPC grants';
