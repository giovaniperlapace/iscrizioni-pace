-- Only a disposable PostgreSQL database; existing suite first reproduces the
-- old serialization_failure behavior and verifies imports/merges and RLS.
\ir data-quality.sql
\ir ../../supabase/migrations/20260921120000_operational_children.sql
\ir ../../supabase/migrations/20260922153000_nonretryable_stale_conflicts.sql

create temp table conflict_before as select
 (select md5(string_agg(to_jsonb(t)::text, '' order by id)) from participants t) participants,
 (select md5(string_agg(to_jsonb(t)::text, '' order by id)) from registrations t) registrations,
 (select count(*) from audit_logs) audits,
 (select count(*) from duplicate_reviews) reviews,
 (select count(*) from participant_imports) imports;

set role service_role;
do $$ declare a uuid := least(fixture_id(82),fixture_id(83)); b uuid := greatest(fixture_id(82),fixture_id(83)); begin
 begin
  perform public.review_participant_duplicate(fixture_id(100),fixture_id(2),a,b,'not_duplicate',null,'Synthetic stale review','stale','a','b');
  raise exception 'stale review accepted';
 exception when sqlstate 'PT409' then assert sqlerrm='Review stale'; end;
 begin
  perform public.commit_participant_import(fixture_id(999),fixture_id(100),fixture_id(2),'stale','hash','[{}]','[]');
  raise exception 'stale import accepted';
 exception when sqlstate 'PT409' then assert sqlerrm='Preview stale'; end;
 begin
  perform public.review_participant_duplicate(fixture_id(100),fixture_id(3),a,b,'not_duplicate',null,'Unauthorized stale review','stale','a','b');
  raise exception 'viewer accepted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 assert (select participants=(select md5(string_agg(to_jsonb(t)::text, '' order by id)) from participants t) from conflict_before);
 assert (select registrations=(select md5(string_agg(to_jsonb(t)::text, '' order by id)) from registrations t) from conflict_before);
 assert (select audits=(select count(*) from audit_logs) and reviews=(select count(*) from duplicate_reviews) and imports=(select count(*) from participant_imports) from conflict_before);
end $$;

insert into registration_children(id,registration_id,position,first_name,last_name,birth_date)
 select fixture_id(999),id,1,'Synthetic','Conflict','2015-01-01' from registrations where event_id=fixture_id(100) and deleted_at is null and not exists(select 1 from registration_children c where c.registration_id=registrations.id) order by id limit 1;
set role service_role;
do $$ begin
 begin
  perform public.update_operational_child(fixture_id(999),fixture_id(2),'{}',null);
  raise exception 'stale child accepted';
 exception when sqlstate 'PT409' then assert sqlerrm='Child changed; reload before saving'; end;
 assert exists(select 1 from registration_children where id=fixture_id(999) and first_name='Synthetic');
end $$;
reset role;
do $$ declare fn regprocedure; begin
 foreach fn in array array[
  'public.review_participant_duplicate(uuid,uuid,uuid,uuid,text,uuid,text,text,text,text)'::regprocedure,
  'public.commit_participant_import(uuid,uuid,uuid,text,text,jsonb,jsonb)'::regprocedure,
  'public.update_operational_child(uuid,uuid,jsonb,jsonb)'::regprocedure
 ] loop
  assert has_function_privilege('service_role',fn,'execute');
  assert not has_function_privilege('anon',fn,'execute');
  assert not has_function_privilege('authenticated',fn,'execute');
  assert position('PT409' in pg_get_functiondef(fn))>0;
  assert position('serialization_failure' in pg_get_functiondef(fn))=0;
  assert position('40001' in pg_get_functiondef(fn))=0;
 end loop;
end $$;
