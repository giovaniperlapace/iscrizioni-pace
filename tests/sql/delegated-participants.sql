-- Run in a disposable empty PostgreSQL database. All identities are synthetic.
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin create role service_role bypassrls; exception when duplicate_object then null; end $$;
grant usage on schema auth to authenticated,service_role;
\ir ../../supabase/migrations/20260613120000_initial_schema_and_rls.sql
\ir ../../supabase/migrations/20260614100000_registration_questionnaire_and_test_seed.sql
\ir ../../supabase/migrations/20260615103000_add_participant_public_code.sql
\ir ../../supabase/migrations/20260615180000_store_retrievable_qr_tokens.sql
\ir ../../supabase/migrations/20260616103000_group_tree_matching.sql
\ir ../../supabase/migrations/20260616143000_group_leader_dashboard_metadata.sql
\ir ../../supabase/migrations/20260624100000_current_operational_event.sql
\ir ../../supabase/migrations/20260702100000_attendance_half_day_slots.sql
\ir ../../supabase/migrations/20260720100000_future_events_communications_consent.sql
\ir ../../supabase/migrations/20260728180000_registration_children.sql
\ir ../../supabase/migrations/20260905120000_minimize_accessibility_data.sql
\ir ../../supabase/migrations/20260905150000_operative_group_assignments.sql
alter table public.group_memberships add column is_primary boolean not null default false;
create function public.fixture_id(n integer) returns uuid language sql immutable as $$ select md5(n::text)::uuid $$;
update public.events set is_current=false;
insert into public.events(id,slug,title,city,country,is_current,starts_on,ends_on)
 values(fixture_id(100),'fixture','Fixture','Test','Test',true,'2026-10-01','2026-10-02'),
 (fixture_id(101),'archive','Archive','Test','Test',false,'2025-10-01','2025-10-02');
insert into auth.users select fixture_id(i) from generate_series(1,7) i;
insert into public.profiles(id,email,full_name) select fixture_id(i),'user'||i||'@example.org','User '||i from generate_series(1,7) i;
insert into public.groups(id,event_id,name,parent_group_id,is_active,is_assignable)
 values(fixture_id(200),fixture_id(100),'Parent',null,true,false),
 (fixture_id(201),fixture_id(100),'Child',fixture_id(200),true,true),
 (fixture_id(202),fixture_id(100),'Other',null,true,true),
 (fixture_id(203),fixture_id(101),'Archived',null,true,true);
insert into public.group_memberships(group_id,user_id,role,is_primary)
 values(fixture_id(200),fixture_id(1),'capogruppo',true),(fixture_id(202),fixture_id(2),'capogruppo',true),
 (fixture_id(203),fixture_id(1),'capogruppo',true);
-- Existing email-less participant for deterministic backfill; a delegate contact
-- must never count as a personal email or as account ownership.
insert into public.participants(id,first_name,last_name) values(fixture_id(300),'Legacy','Participant');
insert into public.registrations(id,event_id,participant_id,source,created_by)
 values(fixture_id(400),fixture_id(100),fixture_id(300),'capogruppo',fixture_id(1));
insert into public.participant_contacts(participant_id,email,is_delegate_contact)
 values(fixture_id(300),'user1@example.org',true);
insert into public.participant_group_assignments(registration_id,group_id,is_current,status,source)
 values(fixture_id(400),fixture_id(201),true,'confirmed','capogruppo');
\ir ../../supabase/migrations/20260905190000_delegated_participants.sql
grant all on all tables in schema public to service_role;
grant usage on schema public,app,extensions to service_role;

create function public.fixture_payload() returns jsonb language sql as $$ select jsonb_build_object(
 'groupId',fixture_id(201),'firstName','Synthetic','lastName','Participant','email',null,'phone',null,
 'consentConfirmed',true,'deliveryMode','delegated','privacyVersion','fixture','questionnaireVersion','fixture',
 'answers','{}'::jsonb,'visibilitySummary','{}'::jsonb,'accessibilityAnswers','{}'::jsonb,
 'children',jsonb_build_array(jsonb_build_object('firstName','Child','lastName','Fixture','birthDate','2018-01-01','position',1)),
 'availabilityUnknown',false,'availabilitySlots',jsonb_build_array(jsonb_build_object('day','2026-10-01','part','morning')),
 'qrHash',md5(random()::text),'qrEncrypted','encrypted-fixture') $$;
create table public.fixture_registration(id uuid);
grant all on public.fixture_registration to service_role;
grant select on public.fixture_registration to authenticated;
set role service_role;
insert into public.fixture_registration select public.create_managed_registration(fixture_id(1),fixture_payload());
reset role;

do $$ declare rid uuid := (select id from fixture_registration); pid uuid; before_count bigint; begin
 select participant_id into pid from registrations where id=rid;
 assert (select auth_user_id is null from participants where id=pid),'email-less account created';
 assert not exists(select 1 from participant_contacts where participant_id=pid),'fabricated contact created';
 assert (select responsible_user_id=fixture_id(1) and delivery_mode='delegated' from registration_responsibilities where registration_id=rid),'responsibility missing';
 assert (select accepted_by_user_id=fixture_id(1) and accepted_by_name='User 1' from participant_consents where registration_id=rid),'consent attributed to participant instead of declarant';
 assert (select count(*)=1 from qr_tokens where registration_id=rid),'real QR record missing';
 assert (select count(*)=1 from event_attendance_choices where registration_id=rid),'attendance missing';
 assert (select count(*)=1 from registration_children where registration_id=rid),'child missing';
 assert (select delivery_mode='delegated' from registration_responsibilities where registration_id=fixture_id(400)),'legacy delegate mistaken for personal';
 assert (select count(*)=2 from resolve_registration_deliveries(fixture_id(100)) where delivery_kind='delegated'),'delegates not resolved';
 select count(*) into before_count from participants;
 begin
   perform create_managed_registration(fixture_id(1),fixture_payload()||'{"qrHash":null}');
   raise exception 'incomplete transaction accepted';
 exception when not_null_violation then null; end;
 assert (select count(*)=before_count from participants),'failed QR write left orphan participant';
 begin perform create_managed_registration(fixture_id(2),fixture_payload()); raise exception 'foreign scope accepted'; exception when insufficient_privilege then null; end;
 begin perform create_managed_registration(fixture_id(1),fixture_payload()||jsonb_build_object('groupId',fixture_id(203))); raise exception 'archived event accepted'; exception when insufficient_privilege then null; end;
 begin perform create_managed_registration(fixture_id(1),fixture_payload()||'{"consentConfirmed":false}'); raise exception 'missing consent accepted'; exception when check_violation then null; end;
 assert not has_function_privilege('authenticated','public.create_managed_registration(uuid,jsonb)','execute'),'actor spoof RPC available';
 assert not has_function_privilege('anon','public.read_managed_registration_card(uuid)','execute'),'anonymous QR available';
end $$;

select set_config('request.jwt.claim.sub',fixture_id(1)::text,false);
set role authenticated;
do $$ declare rid uuid := (select id from fixture_registration); pid uuid; aid uuid; card jsonb; begin
 select participant_id into pid from registrations where id=rid;
 select id into aid from participant_group_assignments where registration_id=rid;
 assert pid is not null,'parent leader RLS cannot read descendant';
 card := read_managed_registration_card(rid);
 assert card->'qr'->>'token_encrypted'='encrypted-fixture','authorized QR unavailable';
 begin perform set_registration_delivery(rid,'personal'); raise exception 'missing personal email accepted'; exception when check_violation then null; end;
 perform update_managed_participant(aid,pid,'{"identityUpdate":false,"contactUpdate":true,"email":"personal@example.org","phone":null}');
 perform set_registration_delivery(rid,'personal');
 assert (select auth_user_id is null from participants where id=pid),'adding email created account without verified login';
 begin perform update_managed_participant(aid,pid,'{"contactUpdate":true,"email":"user1@example.org"}'); raise exception 'leader email stored as personal'; exception when unique_violation then null; end;
 perform set_registration_delivery(rid,'delegated');
 assert (select email='personal@example.org' from participant_contacts where participant_id=pid),'delegation changed personal email';
end $$;
reset role;
-- Account linking later attaches to the same participant id using PERSONAL email.
update participants set auth_user_id=fixture_id(3) where id=(select participant_id from registrations where id=(select id from fixture_registration));
set role authenticated;
do $$ declare rid uuid := (select id from fixture_registration); pid uuid; aid uuid; begin
 select participant_id into pid from registrations where id=rid;
 select id into aid from participant_group_assignments where registration_id=rid;
 begin perform update_managed_participant(aid,pid,'{"contactUpdate":true,"email":"replacement@example.org"}'); raise exception 'linked identity email changed by leader'; exception when check_violation then null; end;
end $$;
reset role;
-- Existing owner and operational roles retain their intended table reads.
insert into public.event_user_roles(user_id,event_id,role) values
 (fixture_id(4),fixture_id(100),'manager_viewer'),(fixture_id(5),fixture_id(100),'manager'),
 (fixture_id(6),fixture_id(100),'accoglienza'),(fixture_id(7),null,'admin');
select set_config('request.jwt.claim.sub',fixture_id(3)::text,false);
set role authenticated;
do $$ begin assert exists(select 1 from registrations where id=(select id from fixture_registration)), 'owner lost own registration'; end $$;
reset role;
select set_config('request.jwt.claim.sub',fixture_id(4)::text,false);
set role authenticated;
do $$ begin
 assert exists(select 1 from registrations where id=(select id from fixture_registration)), 'manager viewer lost scoped read';
 assert exists(select 1 from registration_responsibilities where registration_id=(select id from fixture_registration)), 'manager viewer lost responsibility read';
 begin perform set_registration_delivery((select id from fixture_registration),'delegated'); raise exception 'viewer can mutate delivery'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',fixture_id(5)::text,false);
set role authenticated;
do $$ begin assert exists(select 1 from registrations where id=(select id from fixture_registration)), 'manager lost read'; end $$;
reset role;
select set_config('request.jwt.claim.sub',fixture_id(6)::text,false);
set role authenticated;
do $$ begin
 assert not exists(select 1 from registration_responsibilities where registration_id=(select id from fixture_registration)), 'reception reads responsibility';
 begin perform read_managed_registration_card((select id from fixture_registration)); raise exception 'reception reads complete card'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',fixture_id(7)::text,false);
set role authenticated;
do $$ begin assert exists(select 1 from registrations where id=(select id from fixture_registration)), 'admin lost read'; end $$;
reset role;
-- Other leader cannot read card, contact, registration, or route communications.
select set_config('request.jwt.claim.sub',fixture_id(2)::text,false);
set role authenticated;
do $$ declare rid uuid := (select id from fixture_registration); begin
 assert not exists(select 1 from registrations where id=rid),'registration RLS leak';
 assert not exists(select 1 from registration_responsibilities where registration_id=rid),'responsibility RLS leak';
 begin perform read_managed_registration_card(rid); raise exception 'foreign QR read accepted'; exception when insufficient_privilege then null; end;
 begin perform set_registration_delivery(rid,'delegated'); raise exception 'foreign delegation accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Scope removal prevents both future access and queued delegated delivery.
delete from group_memberships where user_id=fixture_id(1) and group_id=fixture_id(200);
select set_config('request.jwt.claim.sub',fixture_id(1)::text,false);
set role authenticated;
do $$ begin
 assert not exists(select 1 from registrations where id=fixture_id(400)),'former leader retains RLS access';
 begin perform read_managed_registration_card((select id from fixture_registration)); raise exception 'former leader retains QR'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 assert not exists(select 1 from resolve_registration_deliveries(fixture_id(100))),'stale delegate remains reachable';
 assert (select count(*)>=1 from audit_logs where action='group_leader.participant_card_viewed'),'card access not audited';
 assert (select count(*)=1 from audit_logs where action='registration.created_by_group_leader'),'transaction audit missing or leaked rollback';
end $$;
-- Deleting the former leader account leaves history, without a usable delegate.
delete from auth.users where id=fixture_id(1);
do $$ begin
 assert (select responsible_user_id is null and declared_by is null from registration_responsibilities where registration_id=fixture_id(400)), 'responsibility prevents deleting obsolete account';
 assert not exists(select 1 from resolve_registration_deliveries(fixture_id(100))), 'deleted delegate still receives mail';
end $$;
