-- Disposable database only. Runs existing scope checks first.
\ir operational-registration-additions.sql
update groups set is_active=true where id=f(21);
create schema auth;
create table auth.users(id uuid primary key);
insert into auth.users values(f(30)),(f(40));
create table countries(id uuid primary key,name_it text);
create table participants(id uuid primary key,country_id uuid,country_other text);
alter table registrations add column participant_id uuid;
alter table registrations add column created_by uuid;
alter table registrations add column source text;
insert into participants values(f(100),null,null);
update registrations set participant_id=f(100),created_by=f(40),source='capogruppo';
create table registration_questionnaire_answers(id uuid primary key default gen_random_uuid(),registration_id uuid,event_id uuid,questionnaire_version text,answers jsonb default '{}',created_at timestamptz default now(),unique(registration_id,questionnaire_version));
insert into registration_questionnaire_answers(registration_id,event_id,questionnaire_version,answers)
values(f(10),f(1),'original','{"nationality":"Italian","birthPlace":"Roma, Italia","attendance":{"untouched":true}}');
\ir ../../supabase/migrations/20260929120000_assisted_demographics.sql

do $$ declare original jsonb; changed jsonb; actor uuid; begin
 assert (select count(*)=0 from registration_internal_demographics);
 original:=get_operational_demographics(f(10),f(40));
 assert original->>'nationality'='Italian';
 changed:=update_operational_demographics(f(10),f(40),original,'{"nationality":"French","birthPlace":"France","country":"Germany"}');
 assert changed->>'country'='Germany';
 assert (select answers->'attendance'='{"untouched":true}'::jsonb from registration_questionnaire_answers where registration_id=f(10));
 begin perform update_operational_demographics(f(10),f(30),original,'{"nationality":null,"birthPlace":null,"country":null}'); raise exception 'stale bypass'; exception when sqlstate 'PT409' then null; end;
 begin perform update_operational_demographics(f(10),f(40),changed,'{"nationality":null,"birthPlace":null,"country":null,"sex":"male"}'); raise exception 'unexpected key bypass'; exception when invalid_parameter_value then null; end;
 perform set_assisted_registration_sex(f(10),f(40),'female');
 perform set_assisted_registration_sex(f(10),f(40),'female');
 assert (select count(*)=1 from registration_internal_demographics);
 assert (select sex='female' from get_operational_registration_sexes(array[f(10)],f(30)));
 assert (select sex='female' from get_operational_registration_sexes(array[f(10)],f(40)));
 assert not exists(select 1 from registration_questionnaire_answers where answers::text like '%female%');
 assert not exists(select 1 from audit_logs where metadata::text like '%female%');
 begin perform set_assisted_registration_sex(f(10),f(40),'male'); raise exception 'overwrite bypass'; exception when sqlstate 'PT409' then null; end;
 foreach actor in array array[f(33),f(41),f(42),f(999)] loop
   begin perform get_operational_registration_sexes(array[f(10)],actor); raise exception 'scope bypass'; exception when insufficient_privilege then null; end;
   begin perform get_operational_demographics(f(10),actor); raise exception 'scope bypass'; exception when insufficient_privilege then null; end;
 end loop;
 begin perform get_operational_registration_sexes(array[f(10),f(11)],f(40)); raise exception 'mixed scope bypass'; exception when insufficient_privilege then null; end;
 begin perform get_operational_registration_sexes(array[f(12)],f(30)); raise exception 'deleted bypass'; exception when insufficient_privilege then null; end;
 begin perform set_assisted_registration_sex(f(10),f(30),'male'); raise exception 'creator bypass'; exception when insufficient_privilege then null; end;
 assert not has_table_privilege('authenticated','registration_internal_demographics','SELECT');
 assert not has_table_privilege('anon','registration_internal_demographics','SELECT');
 assert not has_function_privilege('authenticated','get_operational_registration_sexes(uuid[],uuid)','EXECUTE');
 assert not has_function_privilege('anon','get_operational_demographics(uuid,uuid)','EXECUTE');
 assert has_function_privilege('service_role','get_operational_registration_sexes(uuid[],uuid)','EXECUTE');
 assert (select relrowsecurity from pg_class where oid='registration_internal_demographics'::regclass);
end $$;
set role authenticated;
do $$ begin
 begin perform * from public.registration_internal_demographics; raise exception 'direct select bypass'; exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Clear only explicitly edited fields; preserve all other questionnaire content.
do $$ declare snapshot jsonb; begin
 snapshot:=get_operational_demographics(f(10),f(40));
 perform update_operational_demographics(f(10),f(40),snapshot,'{"nationality":null,"birthPlace":null,"country":null}');
 assert (select country_other is null and country_id is null from participants where id=f(100));
 assert (select answers->'nationality'='null'::jsonb and answers->'attendance'='{"untouched":true}'::jsonb from registration_questionnaire_answers where registration_id=f(10));
 assert (select sex='female' from registration_internal_demographics where registration_id=f(10));
end $$;
-- An audit failure must roll the entire geography update back.
create function fail_demographics_audit() returns trigger language plpgsql as $$ begin
 if new.action='registration.demographics_updated' then raise exception 'Synthetic audit failure'; end if; return new;
end $$;
create trigger fail_demographics before insert on audit_logs for each row execute function fail_demographics_audit();
do $$ declare snapshot jsonb; begin
 snapshot:=get_operational_demographics(f(10),f(40));
 begin
   perform update_operational_demographics(f(10),f(40),snapshot,'{"nationality":"Changed","birthPlace":"Changed","country":"Changed"}');
   raise exception 'expected audit failure';
 exception when raise_exception then assert sqlerrm='Synthetic audit failure'; end;
 assert get_operational_demographics(f(10),f(40))=snapshot;
end $$;
drop trigger fail_demographics on audit_logs;
