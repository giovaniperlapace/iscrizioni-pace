-- Disposable PostgreSQL only. No real users or email.
create role anon; create role authenticated; create role service_role;
create type public.app_role as enum('admin','manager','manager_viewer','capogruppo','accoglienza');
create function f(n int) returns uuid language sql immutable as $$select md5(n::text)::uuid$$;
create table event_user_roles(id uuid default gen_random_uuid(),user_id uuid,event_id uuid,role app_role);
create table profiles(id uuid primary key,full_name text,email text);
create table groups(id uuid primary key,event_id uuid,primary_leader_name text);
create table group_memberships(id uuid default gen_random_uuid(),user_id uuid,group_id uuid,role app_role,is_primary boolean,created_at timestamptz default now());
create table audit_logs(event_id uuid,actor_user_id uuid,action text,entity_table text,entity_id uuid,metadata jsonb);
insert into event_user_roles(user_id,event_id,role) values(f(1),f(10),'manager'),(f(2),f(20),'manager'),(f(3),null,'admin'),(f(4),f(10),'manager_viewer'),(f(5),f(10),'accoglienza'),(f(5),f(10),'manager'),(f(5),f(20),'manager_viewer');
insert into profiles values(f(5),'Target','target@example.test'),(f(6),'Other leader','other@example.test');
insert into groups values(f(100),f(10),'Target'),(f(101),f(10),'Target');
insert into group_memberships(user_id,group_id,role,is_primary) values(f(5),f(100),'capogruppo',true),(f(6),f(100),'capogruppo',true),(f(5),f(101),'capogruppo',false);
\ir ../../supabase/migrations/20260925180000_operational_role_management.sql
-- Check exclusivity in both directions, on INSERT and UPDATE.
do $$ begin
 begin insert into event_user_roles(user_id,event_id,role) values(f(5),f(10),'manager_viewer'); raise exception 'dual manager allowed'; exception when unique_violation then null; end;
 begin insert into event_user_roles(user_id,event_id,role) values(f(4),f(10),'manager'); raise exception 'dual manager allowed'; exception when unique_violation then null; end;
 begin update event_user_roles set role='manager_viewer' where user_id=f(5) and role='accoglienza'; raise exception 'update bypass'; exception when unique_violation then null; end;
 assert not has_function_privilege('anon','remove_operational_role(uuid,uuid,app_role,uuid,uuid)','execute');
 assert not has_function_privilege('authenticated','remove_operational_role(uuid,uuid,app_role,uuid,uuid)','execute');
 assert has_function_privilege('service_role','remove_operational_role(uuid,uuid,app_role,uuid,uuid)','execute');
end $$;
-- Unauthorized actor, own role, foreign event, global admin.
do $$ declare actor int; begin
 foreach actor in array array[2,4,5,99] loop
  begin perform remove_operational_role(f(actor),f(5),'capogruppo',f(10),f(100)); raise exception 'authorization bypass'; exception when insufficient_privilege then null; end;
 end loop;
 begin perform remove_operational_role(f(1),f(3),'admin',null,null); raise exception 'global bypass'; exception when insufficient_privilege then null; end;
 begin perform remove_operational_role(f(1),f(5),'capogruppo',f(20),f(100)); raise exception 'group event mismatch'; exception when invalid_parameter_value then null; end;
 assert (select count(*)=3 from group_memberships);
 assert (select count(*)=0 from audit_logs);
end $$;
-- Fail the formerly separate group-name write: removal must roll back too.
create function fail_name() returns trigger language plpgsql as $$begin raise exception 'synthetic name failure' using errcode='23514'; end$$;
create trigger fail_name before update on groups for each row execute function fail_name();
do $$ begin
 begin perform remove_operational_role(f(1),f(5),'capogruppo',f(10),f(100)); raise exception 'failure not raised'; exception when check_violation then null; end;
 assert (select count(*)=3 from group_memberships);
 assert (select count(*)=0 from audit_logs);
end $$;
drop trigger fail_name on groups;
select remove_operational_role(f(1),f(5),'capogruppo',f(10),f(100));
select remove_operational_role(f(1),f(5),'capogruppo',f(10),f(100));
do $$ begin
 assert (select count(*)=2 from group_memberships);
 assert (select primary_leader_name='Other leader' from groups where id=f(100));
 assert (select count(*)=1 from audit_logs);
 assert (select count(*)=3 from event_user_roles where user_id=f(5));
end $$;
select remove_operational_role(f(1),f(5),'manager',f(10),null);
do $$ begin
 assert (select count(*)=2 from event_user_roles where user_id=f(5));
 assert exists(select 1 from event_user_roles where user_id=f(5) and role='accoglienza');
 assert exists(select 1 from event_user_roles where user_id=f(5) and role='manager_viewer' and event_id=f(20));
 assert (select count(*)=2 from group_memberships);
 assert (select count(*)=2 from profiles);
end $$;
select 'PASS exclusivity, permissions, rollback, idempotency and unrelated roles preserved';
