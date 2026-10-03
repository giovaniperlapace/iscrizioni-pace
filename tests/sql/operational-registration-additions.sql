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

insert into events values(f(1),true),(f(2),false);
insert into registrations values(f(10),f(1),null),(f(11),f(2),null),(f(12),f(1),now());
insert into event_user_roles values(f(30),f(1),'manager'),(f(31),f(2),'manager'),(f(32),null,'admin'),(f(33),f(1),'manager_viewer');
insert into groups values(f(20),f(1),null,true),(f(21),f(1),f(20),true),(f(22),f(1),null,true),(f(23),f(2),null,true),(f(24),f(1),f(20),false);
insert into group_memberships values(f(20),f(40),'capogruppo'),(f(22),f(41),'capogruppo'),(f(23),f(42),'capogruppo');
insert into participant_group_assignments values(f(50),f(10),f(21),true),(f(51),f(11),f(23),true),(f(52),f(12),f(21),true),(f(53),f(10),f(22),false);
insert into registration_children values(f(60),f(10),1,'Anna','Rossi','2015-01-01'),(f(61),f(10),2,'Luca','Rossi','1990-01-01'),(f(62),f(11),1,'Other','Child','2015-01-01'),(f(63),f(12),1,'Deleted','Child','2015-01-01');
create function expected(n int) returns jsonb language sql as $$ select jsonb_build_object('first_name',first_name,'last_name',last_name,'birth_date',birth_date) from registration_children where id=f(n) $$;
create table accessibility_needs(id uuid primary key default gen_random_uuid(),registration_id uuid unique,
 washington_group_answers jsonb not null default '{}', needs_operational_support boolean not null default false,updated_at timestamptz not null default clock_timestamp());
create function touch_accessibility() returns trigger language plpgsql as $$ begin new.updated_at=clock_timestamp(); return new; end $$;
create trigger touch_accessibility before update on accessibility_needs for each row execute function touch_accessibility();
\ir ../../supabase/migrations/20260922190000_operational_registration_additions.sql
grant usage on schema public to service_role,authenticated,anon;
grant select,insert,update,delete on all tables in schema public to service_role;

set role service_role;
-- Both operational roles can add, and historical adult dates remain supported.
select add_operational_child(f(10),f(40),f(70),' {"first_name":"New","last_name":"Child","birth_date":"2017-01-01"}');
select add_operational_child(f(10),f(30),f(71),' {"first_name":"Older","last_name":"Child","birth_date":"1990-01-01"}');
select add_operational_child(f(10),f(40),f(70),' {"first_name":"New","last_name":"Child","birth_date":"2017-01-01"}');
do $$ begin
 assert (select count(*)=4 from registration_children where registration_id=f(10));
 assert (select count(*)=2 from audit_logs);
 assert (select first_name='Anna' from registration_children where id=f(60));
end $$;
-- All reads and mutations enforce authorization, including stale assignments.
do $$ declare actor int; begin
 foreach actor in array array[31,33,41,99] loop
  begin perform add_operational_child(f(10),f(actor),f(80),'{"first_name":"X","last_name":"Y","birth_date":"2015-01-01"}'); raise exception 'scope bypass';
  exception when insufficient_privilege then null; end;
  begin perform get_operational_accessibility(f(10),f(actor)); raise exception 'read bypass';
  exception when insufficient_privilege then null; end;
  begin perform update_operational_accessibility(f(10),f(actor),null,'{}'); raise exception 'write bypass';
  exception when insufficient_privilege then null; end;
 end loop;
 begin perform get_operational_accessibility(f(11),f(42)); raise exception 'noncurrent bypass';
 exception when insufficient_privilege then null; end;
 begin perform get_operational_accessibility(f(12),f(32)); raise exception 'deleted bypass';
 exception when insufficient_privilege then null; end;
end $$;
-- Empty accessibility is distinct from read failure. Edit preserves unknown keys/support.
do $$ begin assert get_operational_accessibility(f(10),f(40)) is null; end $$;
insert into accessibility_needs(registration_id,washington_group_answers,needs_operational_support)
 values(f(10),'{"legacy":true,"hearing":true}',true);
do $$ declare original jsonb; result jsonb; begin
 original:=get_operational_accessibility(f(10),f(40));
 result:=update_operational_accessibility(f(10),f(40),original,'{"hearing":false,"walkingOrSteps":true,"wheelchairOrMobilityAid":true}');
 assert result->'answers' = '{"legacy":true,"hearing":false,"walkingOrSteps":true,"wheelchairOrMobilityAid":true}'::jsonb;
 assert (select needs_operational_support from accessibility_needs where registration_id=f(10));
 begin perform update_operational_accessibility(f(10),f(30),original,'{"hearing":true,"walkingOrSteps":false,"wheelchairOrMobilityAid":false}'); raise exception 'stale bypass';
 exception when sqlstate 'PT409' then null; end;
 begin perform update_operational_accessibility(f(10),f(30),result,'{"hearing":"yes"}'); raise exception 'invalid bypass';
 exception when invalid_parameter_value then null; end;
 assert get_operational_accessibility(f(10),f(40))=result;
end $$;
-- Fill first available hole and reject the eleventh child without audit side effects.
delete from registration_children where id=f(60);
select add_operational_child(f(10),f(32),f(80),'{"first_name":"Hole","last_name":"Child","birth_date":"2015-01-01"}');
do $$ declare n int; audit_count int; begin
 assert (select position=1 from registration_children where id=f(80));
 for n in 81..86 loop
  perform add_operational_child(f(10),f(32),f(n),'{"first_name":"More","last_name":"Child","birth_date":"2015-01-01"}');
 end loop;
 select count(*) into audit_count from audit_logs;
 begin perform add_operational_child(f(10),f(32),f(87),'{"first_name":"Eleventh","last_name":"Child","birth_date":"2015-01-01"}'); raise exception 'limit bypass';
 exception when invalid_parameter_value then null; end;
 assert (select count(*)=10 from registration_children where registration_id=f(10));
 assert (select count(*)=audit_count from audit_logs);
 begin perform add_operational_child(f(10),f(32),f(80),'{"first_name":"Changed","last_name":"Child","birth_date":"2015-01-01"}'); raise exception 'idempotency bypass';
 exception when sqlstate 'PT409' then null; end;
end $$;
update groups set is_active=false where id=f(21);
do $$ begin
 begin perform get_operational_accessibility(f(10),f(40)); raise exception 'inactive bypass';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 assert not has_function_privilege('authenticated','public.add_operational_child(uuid,uuid,uuid,jsonb)','EXECUTE');
 assert not has_function_privilege('anon','public.get_operational_accessibility(uuid,uuid)','EXECUTE');
 assert not has_function_privilege('authenticated','public.update_operational_accessibility(uuid,uuid,jsonb,jsonb)','EXECUTE');
 assert not has_function_privilege('authenticated','public.lock_operational_registration(uuid,uuid)','EXECUTE');
end $$;
