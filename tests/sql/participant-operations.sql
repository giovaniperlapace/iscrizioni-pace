-- Run in a disposable EMPTY PostgreSQL database, never in production.
do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin create role service_role bypassrls; exception when duplicate_object then null; end $$;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated, service_role;
grant execute on function auth.uid() to authenticated, service_role;
\ir ../../supabase/migrations/20260613120000_initial_schema_and_rls.sql
\ir ../../supabase/migrations/20260614100000_registration_questionnaire_and_test_seed.sql
\ir ../../supabase/migrations/20260616103000_group_tree_matching.sql
\ir ../../supabase/migrations/20260616143000_group_leader_dashboard_metadata.sql
\ir ../../supabase/migrations/20260624100000_current_operational_event.sql
\ir ../../supabase/migrations/20260626100000_operational_tags.sql
\ir ../../supabase/migrations/20260711100000_event_services.sql
\ir ../../supabase/migrations/20260712100000_email_campaigns.sql
\ir ../../supabase/migrations/20260728180000_registration_children.sql
\ir ../../supabase/migrations/20260729120000_email_campaign_audiences_and_daily_queue.sql
\ir ../../supabase/migrations/20260905150000_operative_group_assignments.sql
\ir ../../supabase/migrations/20260905190000_registration_soft_delete.sql
\ir ../../supabase/migrations/20260905191000_participant_quick_operations.sql

grant usage on schema public,app,extensions to service_role;
grant all on all tables in schema public to service_role;
grant all on all tables in schema public to authenticated;
create function public.fixture_id(n integer) returns uuid language sql immutable as $$ select md5(n::text)::uuid $$;
insert into auth.users select fixture_id(i) from generate_series(1,6) i;
insert into public.profiles(id,full_name) select fixture_id(i),'Fixture operator' from generate_series(1,6) i;
insert into public.events(id,slug,title,city,country) values (fixture_id(100),'fixture-one','Fixture','Roma','IT'),(fixture_id(101),'fixture-two','Other event','Roma','IT');
insert into public.event_user_roles(user_id,event_id,role) values
(fixture_id(1),null,'admin'),(fixture_id(2),fixture_id(100),'manager'),(fixture_id(3),fixture_id(100),'manager_viewer'),(fixture_id(6),fixture_id(101),'manager');
insert into public.participants(id,auth_user_id,first_name,last_name) values (fixture_id(10),fixture_id(5),'Test','Person'),(fixture_id(11),null,'Other','Person');
insert into public.registrations(id,event_id,participant_id) values (fixture_id(20),fixture_id(100),fixture_id(10)),(fixture_id(21),fixture_id(100),fixture_id(11));
insert into public.groups(id,event_id,name,is_assignable) values (fixture_id(30),fixture_id(100),'Group A',true),(fixture_id(31),fixture_id(100),'Structural',false),(fixture_id(32),fixture_id(101),'Other event',true);
insert into public.group_memberships(group_id,user_id,role) values(fixture_id(30),fixture_id(4),'capogruppo');
insert into public.event_services(id,event_id,label) values(fixture_id(40),fixture_id(100),'Service A'),(fixture_id(41),fixture_id(101),'Other service');
insert into public.operational_tags(id,event_id,label,color) values(fixture_id(50),fixture_id(100),'Tag A','#123456'),(fixture_id(51),fixture_id(100),'Tag B','#123456'),(fixture_id(52),fixture_id(101),'Other tag','#123456');
insert into public.registration_children(registration_id,position,first_name,last_name,birth_date) values(fixture_id(20),1,'Child','Fixture','2015-01-01');
insert into public.registration_questionnaire_answers(registration_id,event_id,questionnaire_version,answers) values(fixture_id(20),fixture_id(100),'fixture','{"keep":"history"}');
insert into public.qr_tokens(registration_id,token_hash,status) values(fixture_id(20),'fixture-active','active'),(fixture_id(20),'fixture-revoked','revoked');
insert into public.check_ins(registration_id,event_id) values(fixture_id(20),fixture_id(100));
insert into public.audit_logs(event_id,action,entity_table,entity_id,metadata) values(fixture_id(100),'historical','registrations',fixture_id(20),'{"keep":"past"}');

insert into public.email_campaigns(id,event_id,name,subject_template,body_template) values(fixture_id(60),fixture_id(100),'Fixture campaign','Fixture subject','Fixture body'),(fixture_id(61),fixture_id(100),'Sent campaign','Fixture subject','Fixture body');
insert into public.email_campaign_recipients(campaign_id,participant_id,registration_id,recipient_key,recipient_type,delivery_kind,status) values(fixture_id(60),fixture_id(10),fixture_id(20),'participant:fixture','participant','direct','scheduled'),(fixture_id(61),fixture_id(10),fixture_id(20),'participant:fixture','participant','direct','sent');
update public.email_campaigns set status='scheduled',sent_at=now(),recipient_count=1 where id=fixture_id(60);
insert into public.email_campaigns(id,event_id,name,subject_template,body_template,status,recipient_count,test_sent_at,test_sent_to_user_id)
values(fixture_id(62),fixture_id(100),'Preview campaign','Fixture subject','Fixture body','ready',1,now(),fixture_id(2));
insert into public.email_campaign_recipients(campaign_id,participant_id,registration_id,recipient_key,recipient_type,delivery_kind,status)
values(fixture_id(62),fixture_id(10),fixture_id(20),'participant:fixture','participant','direct','pending');

set role service_role;
select public.update_registration_operation(fixture_id(20),fixture_id(10),fixture_id(2),'group',jsonb_build_array(fixture_id(30)));
select public.update_registration_operation(fixture_id(20),fixture_id(10),fixture_id(2),'service',jsonb_build_array(fixture_id(40)));
select public.update_registration_operation(fixture_id(20),fixture_id(10),fixture_id(2),'tags',jsonb_build_array(fixture_id(50),fixture_id(51)));
select public.update_registration_operation(fixture_id(20),fixture_id(10),fixture_id(2),'identity','{"firstName":"Updated","email":"FIXTURE@example.test","phone":"1234"}');
do $$ begin
 assert (select first_name='Updated' and last_name='Person' from participants where id=fixture_id(10)), 'partial identity update wiped fields';
 assert (select email='fixture@example.test' from participant_contacts where participant_id=fixture_id(10)), 'contact not saved';
 assert (select is_current and status='confirmed' from participant_group_assignments where registration_id=fixture_id(20)), 'group not operational';
 assert (select count(*)=2 from participant_operational_tags where participant_id=fixture_id(10)), 'multi-tag selection missing';
 begin
  perform public.update_registration_operation(fixture_id(20),fixture_id(10),fixture_id(2),'group',jsonb_build_array(fixture_id(31)));
  raise exception 'structural group accepted';
 exception when check_violation then null; end;
 begin
  perform public.update_registration_operation(fixture_id(20),fixture_id(10),fixture_id(2),'group',jsonb_build_array(fixture_id(32)));
  raise exception 'cross-event group accepted';
 exception when check_violation then null; end;
 begin
  perform public.update_registration_operation(fixture_id(20),fixture_id(10),fixture_id(6),'tags','[]');
  raise exception 'out-of-scope manager accepted';
 exception when insufficient_privilege then null; end;
 begin
  perform public.update_registration_operation(fixture_id(20),fixture_id(10),fixture_id(3),'tags','[]');
  raise exception 'viewer mutation accepted';
 exception when insufficient_privilege then null; end;
 begin
  perform public.update_registration_operation(fixture_id(20),fixture_id(10),fixture_id(2),'tags',jsonb_build_array(fixture_id(52)));
  raise exception 'cross-event tag accepted';
 exception when check_violation then null; end;
 assert (select count(*)=2 from participant_operational_tags where participant_id=fixture_id(10)), 'failed tag validation wiped selection';
 begin
  perform public.update_registration_operation(fixture_id(20),fixture_id(10),fixture_id(2),'service',jsonb_build_array(fixture_id(41)));
  raise exception 'cross-event service accepted';
 exception when check_violation then null; end;
 begin
  perform public.set_registration_deleted(fixture_id(20),fixture_id(10),fixture_id(2),' ');
  raise exception 'empty reason accepted';
 exception when check_violation then null; end;
 begin
  delete from registrations where id=fixture_id(20);
  raise exception 'application hard delete accepted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;

-- A failing audit must roll back both edits and deletion, not just the audit.
create function public.fixture_fail_audit() returns trigger language plpgsql as $$ begin if new.action in ('registration.soft_deleted','participant.operation_updated') then raise check_violation using message='fixture audit failure'; end if; return new; end $$;
create trigger fixture_fail_audit before insert on public.audit_logs for each row execute function public.fixture_fail_audit();
set role service_role;
do $$ begin
 begin
  perform public.set_registration_deleted(fixture_id(20),fixture_id(10),fixture_id(2),'Duplicate registration');
  raise exception 'audit failure ignored';
 exception when check_violation then null; end;
 assert (select deleted_at is null from registrations where id=fixture_id(20)), 'deletion survived failed audit';
 assert (select status='active' from qr_tokens where token_hash='fixture-active'), 'QR mutation survived failed audit';
 begin
  perform public.update_registration_operation(fixture_id(20),fixture_id(10),fixture_id(2),'tags','[]');
  raise exception 'tag audit failure ignored';
 exception when check_violation then null; end;
 assert (select count(*)=2 from participant_operational_tags where participant_id=fixture_id(10)), 'tag changes survived failed audit';
end $$;
reset role;
drop trigger fixture_fail_audit on public.audit_logs;

-- Compare retained dependent rows byte-for-byte across delete and restore.
create temp table historical_rows as select 'children' kind,to_jsonb(t) data from registration_children t where registration_id=fixture_id(20)
union all select 'assignments',to_jsonb(t) from participant_group_assignments t where registration_id=fixture_id(20)
union all select 'questionnaire',to_jsonb(t) from registration_questionnaire_answers t where registration_id=fixture_id(20)
union all select 'checkins',to_jsonb(t) from check_ins t where registration_id=fixture_id(20);
set role service_role;
select public.set_registration_deleted(fixture_id(20),fixture_id(10),fixture_id(2),'Duplicate registration');
do $$ begin
 assert (select status='skipped' and error_code='registration_deleted' from email_campaign_recipients where campaign_id=fixture_id(60)), 'queued campaign still sendable';
 assert (select status='completed' and recipient_count=1 from email_campaigns where id=fixture_id(60)), 'emptied queue not finalized or historical total changed';
 assert (select recipient_count=0 and test_sent_at is null and test_sent_to_user_id is null from email_campaigns where id=fixture_id(62)), 'preview totals or test approval stale after deletion';
 assert (select status='sent' from email_campaign_recipients where campaign_id=fixture_id(61)), 'sent campaign history changed';
 assert (select deleted_at is not null and deleted_by=fixture_id(2) and deletion_reason='Duplicate registration' from registrations where id=fixture_id(20)), 'deletion metadata missing';
 assert (select status='revoked' and suspended_by_registration_deletion from qr_tokens where token_hash='fixture-active'), 'QR remains usable';
 begin
  insert into check_ins(registration_id,event_id,moment_id) values(fixture_id(20),fixture_id(100),null);
  raise exception 'deleted check-in accepted';
 exception when check_violation then null; end;
 begin
  insert into qr_tokens(registration_id,token_hash) values(fixture_id(20),'forbidden-new-token');
  raise exception 'deleted QR issuance accepted';
 exception when check_violation then null; end;
 begin
  perform public.update_registration_operation(fixture_id(20),fixture_id(10),fixture_id(2),'tags','[]');
  raise exception 'deleted registration editable';
 exception when no_data_found then null; end;
 begin
  perform public.set_registration_deleted(fixture_id(20),fixture_id(10),fixture_id(2),'Restore reason',true);
  raise exception 'manager restore accepted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Actual authenticated RLS, including owner, viewer, leader and admin archive.
set role authenticated;
select set_config('request.jwt.claim.sub',fixture_id(5)::text,false);
do $$ begin
 assert not exists(select 1 from registrations where id=fixture_id(20)), 'owner sees deleted registration';
 assert not exists(select 1 from qr_tokens where registration_id=fixture_id(20)), 'owner sees deleted QR';
 assert not exists(select 1 from registration_children where registration_id=fixture_id(20)), 'owner sees deleted child in operational records';
 assert not has_function_privilege('authenticated','public.set_registration_deleted(uuid,uuid,uuid,text,boolean)','execute'), 'actor-spoofable restore RPC';
 assert not has_function_privilege('anon','public.update_registration_operation(uuid,uuid,uuid,text,jsonb)','execute'), 'anonymous operation RPC';
end $$;
select set_config('request.jwt.claim.sub',fixture_id(3)::text,false);
do $$ begin assert not exists(select 1 from registrations where id=fixture_id(20)), 'viewer sees deleted registration'; end $$;
select set_config('request.jwt.claim.sub',fixture_id(4)::text,false);
do $$ begin assert not exists(select 1 from participant_group_assignments where registration_id=fixture_id(20)), 'leader sees deleted assignment'; end $$;
select set_config('request.jwt.claim.sub',fixture_id(1)::text,false);
do $$ begin assert exists(select 1 from registrations where id=fixture_id(20)), 'admin archive unavailable'; end $$;
reset role;
set role service_role;
select public.set_registration_deleted(fixture_id(20),fixture_id(10),fixture_id(1),'Deletion made in error',true);
reset role;
do $$ begin
 assert (select status='skipped' from email_campaign_recipients where campaign_id=fixture_id(60)), 'restore rescheduled skipped campaign';
 assert (select deleted_at is null and restored_by=fixture_id(1) and restored_at is not null from registrations where id=fixture_id(20)), 'restore metadata missing';
 assert (select status='active' from qr_tokens where token_hash='fixture-active'), 'restored active QR missing';
 assert (select status='revoked' from qr_tokens where token_hash='fixture-revoked'), 'restore reactivated previously revoked QR';
 assert exists(select 1 from auth.users where id=fixture_id(5)), 'auth lost';
 assert exists(select 1 from participants where id=fixture_id(10)), 'participant lost';
 assert exists(select 1 from audit_logs where action='historical' and metadata->>'keep'='past'), 'old audit lost';
 assert (select count(*)=2 from audit_logs where entity_id=fixture_id(20) and action in ('registration.soft_deleted','registration.restored')), 'lifecycle audit incomplete';
 assert not exists (
   select * from historical_rows except (
     select 'children',to_jsonb(t) from registration_children t where registration_id=fixture_id(20)
     union all select 'assignments',to_jsonb(t) from participant_group_assignments t where registration_id=fixture_id(20)
     union all select 'questionnaire',to_jsonb(t) from registration_questionnaire_answers t where registration_id=fixture_id(20)
     union all select 'checkins',to_jsonb(t) from check_ins t where registration_id=fixture_id(20)
   )
 ), 'dependent history changed';
end $$;
-- Restoration must permit ordinary owner edits without permitting lifecycle tampering.
set role authenticated;
select set_config('request.jwt.claim.sub',fixture_id(5)::text,false);
do $$ begin
 update registrations set status=status where id=fixture_id(20);
 assert found, 'restored registration cannot be edited by its owner';
 begin
  update registrations set restored_at=null, restored_by=null where id=fixture_id(20);
  raise exception 'owner can erase restoration metadata';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS participant operations, soft delete, RLS, QR, restoration, transactional audit and history' as result;
