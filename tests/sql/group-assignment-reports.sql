-- Run only in a disposable empty PostgreSQL database.
create schema app;
do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin create role service_role; exception when duplicate_object then null; end $$;
create function public.fixture_id(n integer) returns uuid language sql immutable as $$ select md5(n::text)::uuid $$;
create type public.group_assignment_status as enum ('probable', 'confirmed', 'rejected');
create table public.events(id uuid primary key, is_current boolean);
create table public.participants(id uuid primary key, participates_with_group boolean);
create table public.registrations(id uuid primary key, event_id uuid, participant_id uuid, deleted_at timestamptz);
create table public.groups(id uuid primary key, parent_group_id uuid, event_id uuid, is_active boolean);
create table public.group_memberships(group_id uuid, user_id uuid, role text);
create table public.participant_group_assignments(
 id uuid primary key, registration_id uuid, group_id uuid,
 status public.group_assignment_status default 'probable', source text,
 assignment_reason text, is_current boolean not null default true,
 confirmed_by uuid, confirmed_at timestamptz, leader_decision_by uuid,
 leader_decision_at timestamptz, leader_internal_note text,
 leader_note_updated_by uuid, leader_note_updated_at timestamptz,
 leader_notification_read_at timestamptz, updated_at timestamptz
);
create unique index one_current_assignment on public.participant_group_assignments(registration_id) where is_current;
create table public.audit_logs(event_id uuid, actor_user_id uuid, action text, entity_table text, entity_id uuid, metadata jsonb);
insert into public.events values (fixture_id(100), true), (fixture_id(101), false);
insert into public.groups values
 (fixture_id(200), null, fixture_id(100), true),
 (fixture_id(201), fixture_id(200), fixture_id(100), true),
 (fixture_id(202), null, fixture_id(100), true);
insert into public.group_memberships values
 (fixture_id(200), fixture_id(300), 'capogruppo'),
 (fixture_id(202), fixture_id(301), 'capogruppo');
insert into public.participants select fixture_id(i), case when i in (3,4) then false when i=6 then null else true end from generate_series(1,8) i;
insert into public.registrations(id,event_id,participant_id) select fixture_id(i), fixture_id(100), fixture_id(i) from generate_series(1,8) i;
insert into public.participant_group_assignments(id, registration_id, group_id, status, source, assignment_reason, is_current, leader_internal_note, leader_notification_read_at)
select fixture_id(i), fixture_id(i), fixture_id(201),
 case when i in (4,7) then 'confirmed' when i=5 then 'rejected' else 'probable' end::public.group_assignment_status,
 case when i in (2,7) then 'rule' when i=4 then 'manager' when i=8 then 'capogruppo' else 'participant_selected' end,
 case when i=2 then 'territorial_review_queue' when i=8 then 'group_leader_rejected_escalated_to_parent' else null end,
 i<>5, 'Keep internal note', '2026-08-01'::timestamptz
from generate_series(1,8) i;
insert into public.audit_logs(action, entity_id, metadata) values
 ('historical.audit', fixture_id(5), '{"keep":"historical decision"}');

\ir ../../supabase/migrations/20260905150000_operative_group_assignments.sql


create function app.can_manage_registration(uuid) returns boolean language sql as $$
 select current_setting('test.manager', true) = 'yes'; $$;
alter table public.participant_group_assignments enable row level security;
create policy "group assignments update manager or group leader" on public.participant_group_assignments for update using (true);
create policy fixture_read on public.participant_group_assignments for select using (true);
\ir ../../supabase/migrations/20260915160000_group_assignment_reports.sql

alter role service_role bypassrls;
grant usage on schema public, app to service_role, authenticated;
grant select, update on public.participant_group_assignments to service_role, authenticated;
grant select on public.events, public.registrations, public.groups, public.group_memberships to service_role;
grant select, insert on public.audit_logs to service_role;
create temp table before_assignments as select * from public.participant_group_assignments;
set role service_role;
select public.report_group_assignment(fixture_id(1), fixture_id(300), 'Do not overwrite notes', true);
select public.report_group_assignment(fixture_id(1), fixture_id(300));
select public.reject_group_assignment(fixture_id(1), fixture_id(300));
reset role;
do $$ begin
 assert not exists ((select * from before_assignments except select * from public.participant_group_assignments)
 union all (select * from public.participant_group_assignments except select * from before_assignments)), 'assignment data changed';
 assert (select count(*)=1 from public.audit_logs where action='group_leader.assignment_reported'), 'report missing or duplicated';
 assert not has_function_privilege('authenticated','public.report_group_assignment(uuid,uuid,text,boolean)','execute'), 'actor spoofing allowed';
 assert not has_function_privilege('anon','public.reject_group_assignment(uuid,uuid,text,boolean)','execute'), 'legacy RPC exposed';
 begin
  perform public.report_group_assignment(fixture_id(4),fixture_id(301));
  raise exception 'out-of-scope report accepted';
 exception when insufficient_privilege then null; end;
 begin
  perform public.report_group_assignment(fixture_id(5),fixture_id(300));
  raise exception 'inactive assignment accepted';
 exception when no_data_found then null; end;
 update public.registrations set deleted_at=now() where id=fixture_id(4);
 begin
  perform public.report_group_assignment(fixture_id(4),fixture_id(300));
  raise exception 'deleted registration accepted';
 exception when insufficient_privilege then null; end;
 update public.registrations set deleted_at=null where id=fixture_id(4);
 update public.events set is_current=false where id=fixture_id(100);
 begin
  perform public.report_group_assignment(fixture_id(4),fixture_id(300));
  raise exception 'old event accepted';
 exception when insufficient_privilege then null; end;
 update public.events set is_current=true where id=fixture_id(100);
end $$;
set role authenticated;
select set_config('test.manager','no',false);
update public.participant_group_assignments set is_current=false where id=fixture_id(4);
reset role;
do $$ begin assert (select is_current from public.participant_group_assignments where id=fixture_id(4)), 'leader changed assignment directly'; end $$;
set role authenticated;
select set_config('test.manager','yes',false);
update public.participant_group_assignments set is_current=false where id=fixture_id(4);
reset role;
do $$ begin assert not (select is_current from public.participant_group_assignments where id=fixture_id(4)), 'manager update blocked'; end $$;

create function app.fail_test_report() returns trigger language plpgsql as $$ begin raise exception 'synthetic report failure'; end $$;
create trigger fail_test_report before insert on public.audit_logs for each row execute function app.fail_test_report();
do $$ begin
 begin
  perform public.report_group_assignment(fixture_id(6),fixture_id(300));
  raise exception 'storage error hidden';
 exception when raise_exception then
  assert sqlerrm='synthetic report failure', 'unexpected error';
 end;
 assert (select is_current and status='confirmed' and leader_internal_note='Keep internal note' from public.participant_group_assignments where id=fixture_id(6)), 'failed report changed assignment';
 assert not exists(select 1 from public.audit_logs where action='group_leader.assignment_reported' and entity_id=fixture_id(6)), 'failed report persisted';
end $$;
