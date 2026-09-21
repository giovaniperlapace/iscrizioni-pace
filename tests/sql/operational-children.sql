-- Run only in a disposable PostgreSQL database with psql -v ON_ERROR_STOP=1.
create role anon; create role authenticated; create role service_role;
create function f(n int) returns uuid language sql immutable as $$ select md5(n::text)::uuid $$;
create table events(id uuid primary key,is_current boolean);
create table registrations(id uuid primary key,event_id uuid,deleted_at timestamptz);
create table event_user_roles(user_id uuid,event_id uuid,role text);
create table groups(id uuid primary key,event_id uuid,parent_group_id uuid,is_active boolean);
create table group_memberships(group_id uuid,user_id uuid,role text);
create table participant_group_assignments(id uuid primary key,registration_id uuid,group_id uuid,is_current boolean);
create table registration_children(id uuid primary key,registration_id uuid,position smallint,first_name text,last_name text,birth_date date,unique(registration_id,position));
create table audit_logs(event_id uuid,actor_user_id uuid,action text,entity_table text,entity_id uuid,metadata jsonb);
\ir ../../supabase/migrations/20260921120000_operational_children.sql
insert into events values(f(1),true),(f(2),false);
insert into registrations values(f(10),f(1),null),(f(11),f(2),null),(f(12),f(1),now());
insert into event_user_roles values(f(30),f(1),'manager'),(f(31),f(2),'manager'),(f(32),null,'admin'),(f(33),f(1),'manager_viewer');
insert into groups values(f(20),f(1),null,true),(f(21),f(1),f(20),true),(f(22),f(1),null,true),(f(23),f(2),null,true),(f(24),f(1),f(20),false);
insert into group_memberships values(f(20),f(40),'capogruppo'),(f(22),f(41),'capogruppo'),(f(23),f(42),'capogruppo');
insert into participant_group_assignments values(f(50),f(10),f(21),true),(f(51),f(11),f(23),true),(f(52),f(12),f(21),true),(f(53),f(10),f(22),false);
insert into registration_children values(f(60),f(10),1,'Anna','Rossi','2015-01-01'),(f(61),f(10),2,'Luca','Rossi','1990-01-01'),(f(62),f(11),1,'Other','Child','2015-01-01'),(f(63),f(12),1,'Deleted','Child','2015-01-01');
create function expected(n int) returns jsonb language sql as $$ select jsonb_build_object('first_name',first_name,'last_name',last_name,'birth_date',birth_date) from registration_children where id=f(n) $$;
grant usage on schema public to service_role,authenticated,anon;
grant select,insert,update,delete on all tables in schema public to service_role;
set role service_role;
-- Manager and ancestor leader update without touching siblings or IDs.
select update_operational_child(f(60),f(30),expected(60),'{"first_name":"Anna Maria","last_name":"Bianchi","birth_date":"2016-02-29"}');
select update_operational_child(f(61),f(40),expected(61),'{"first_name":"Luca Paolo","last_name":"Rossi","birth_date":"1990-01-01"}');
do $$ begin
 assert (select count(*)=4 from registration_children);
 assert (select first_name='Anna Maria' and birth_date='2016-02-29' from registration_children where id=f(60));
 assert (select count(*)=2 from audit_logs);
end $$;
-- Unrelated manager, read-only manager, unrelated leader, participant denied.
do $$ declare actor int; begin
 foreach actor in array array[31,33,41,99] loop
  begin perform update_operational_child(f(60),f(actor),expected(60),null); raise exception 'scope bypass';
  exception when insufficient_privilege then null; end;
 end loop;
 begin perform update_operational_child(f(62),f(42),expected(62),null); raise exception 'noncurrent event bypass';
 exception when insufficient_privilege then null; end;
 begin perform update_operational_child(f(63),f(32),expected(63),null); raise exception 'deleted registration bypass';
 exception when insufficient_privilege then null; end;
 assert (select count(*)=4 from registration_children);
end $$;
-- Inactive descendant and revoked membership denied.
update groups set is_active=false where id=f(21);
do $$ begin
 begin perform update_operational_child(f(60),f(40),expected(60),null); raise exception 'inactive bypass';
 exception when insufficient_privilege then null; end;
end $$;
update groups set is_active=true where id=f(21);
delete from group_memberships where user_id=f(40);
do $$ begin
 begin perform update_operational_child(f(60),f(40),expected(60),null); raise exception 'revoked bypass';
 exception when insufficient_privilege then null; end;
end $$;
-- Stale save/delete and invalid dates leave data/audit unchanged.
do $$ declare payload jsonb; begin
 begin perform update_operational_child(f(60),f(30),'{}',null); raise exception 'stale bypass';
 exception when serialization_failure then null; end;
 foreach payload in array array['{}'::jsonb,'null','[]','{"first_name":"","last_name":"Rossi","birth_date":"2015-01-01"}',
 '{"first_name":"Anna","last_name":"Rossi","birth_date":"2099-01-01"}',
 '{"first_name":"Anna","last_name":"Rossi","birth_date":"2025-02-30"}'] loop
  begin perform update_operational_child(f(60),f(30),expected(60),payload); raise exception 'invalid bypass';
  exception when invalid_parameter_value or datetime_field_overflow then null; end;
 end loop;
 assert (select count(*)=2 from audit_logs);
end $$;
-- Deleting one child preserves parent, sibling and historical date. Audit has before/after.
select update_operational_child(f(60),f(30),expected(60),null);
do $$ begin
 assert not exists(select 1 from registration_children where id=f(60));
 assert exists(select 1 from registration_children where id=f(61) and birth_date='1990-01-01');
 assert exists(select 1 from registrations where id=f(10) and deleted_at is null);
 assert (select metadata->'before'->>'first_name'='Anna Maria' and metadata->'after'='null'::jsonb from audit_logs where action='registration_child.deleted');
end $$;
-- Global admin can manage a noncurrent event; full rollback on audit error.
select update_operational_child(f(62),f(32),expected(62),'{"first_name":"Other","last_name":"Updated","birth_date":"2015-01-01"}');
reset role;
create function fail_audit() returns trigger language plpgsql as $$ begin raise exception 'synthetic audit failure'; end $$;
create trigger fail_audit before insert on audit_logs for each row execute function fail_audit();
set role service_role;
do $$ begin
 begin perform update_operational_child(f(61),f(30),expected(61),null); raise exception 'unexpected success';
 exception when raise_exception then assert sqlerrm='synthetic audit failure'; end;
 assert exists(select 1 from registration_children where id=f(61));
end $$;
reset role;
do $$ begin
 assert not has_function_privilege('anon','public.update_operational_child(uuid,uuid,jsonb,jsonb)','EXECUTE');
 assert not has_function_privilege('authenticated','public.update_operational_child(uuid,uuid,jsonb,jsonb)','EXECUTE');
 assert has_function_privilege('service_role','public.update_operational_child(uuid,uuid,jsonb,jsonb)','EXECUTE');
end $$;
