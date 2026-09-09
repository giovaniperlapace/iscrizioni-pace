-- Run only in a disposable empty PostgreSQL database.
create schema app;
do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin create role service_role; exception when duplicate_object then null; end $$;
create function public.fixture_id(n integer) returns uuid language sql immutable as $$ select md5(n::text)::uuid $$;
create type public.group_assignment_status as enum ('probable', 'confirmed', 'rejected');
create table public.events(id uuid primary key, is_current boolean);
create table public.participants(id uuid primary key, participates_with_group boolean);
create table public.registrations(id uuid primary key, event_id uuid, participant_id uuid);
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
insert into public.registrations select fixture_id(i), fixture_id(100), fixture_id(i) from generate_series(1,8) i;
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

grant usage on schema public, app to service_role;
grant select, update on public.participant_group_assignments to service_role;
grant select on public.events, public.registrations, public.groups, public.group_memberships to service_role;
grant insert on public.audit_logs to service_role;

do $$ begin
 assert (select status='confirmed' and is_current and confirmed_at is null and confirmed_by is null from public.participant_group_assignments where id=fixture_id(1)), 'explicit assignment did not become operative';
 assert (select bool_and(not is_current) from public.participant_group_assignments where id in (fixture_id(2),fixture_id(3),fixture_id(8))), 'automatic/no-group/escalated queue remains current';
 assert (select is_current from public.participant_group_assignments where id=fixture_id(4)), 'manager override lost';
 assert (select is_current from public.participant_group_assignments where id=fixture_id(6)), 'legacy null questionnaire mishandled';
 assert (select is_current from public.participant_group_assignments where id=fixture_id(7)), 'previously confirmed assignment lost';
 assert (select count(*)=1 from public.audit_logs where action='historical.audit' and metadata->>'keep'='historical decision'), 'historical audit changed';
 assert (select count(*)=5 from public.audit_logs where action='participant.group_assignment_migrated'), 'migration audit incomplete';
 assert (select bool_and(leader_internal_note='Keep internal note' and leader_notification_read_at='2026-08-01'::timestamptz) from public.participant_group_assignments), 'historical metadata changed';
 assert not has_function_privilege('anon','public.reject_group_assignment(uuid,uuid,text,boolean)','execute'), 'anon can reject';
 assert not has_function_privilege('authenticated','public.reject_group_assignment(uuid,uuid,text,boolean)','execute'), 'authenticated can spoof actor';
end $$;

-- Authorized parent leader rejects a descendant: no replacement at the parent.
set role service_role;
select public.reject_group_assignment(fixture_id(1),fixture_id(300));
reset role;
do $$ begin
 assert not exists(select 1 from public.participant_group_assignments where registration_id=fixture_id(1) and is_current), 'rejection retained a current assignment';
 assert (select count(*)=1 from public.audit_logs where entity_id=fixture_id(1) and action='group_leader.assignment_rejected' and metadata->>'moved_to_without_group'='true'), 'rejection audit missing';
 begin
  perform public.reject_group_assignment(fixture_id(1),fixture_id(300));
  raise exception 'repeated rejection accepted';
 exception when no_data_found then null;
 end;
 begin
  perform public.reject_group_assignment(fixture_id(4),fixture_id(301));
  raise exception 'out-of-scope rejection accepted';
 exception when insufficient_privilege then null;
 end;
 assert (select is_current from public.participant_group_assignments where id=fixture_id(4)), 'out-of-scope request mutated data';
 update public.participant_group_assignments set status='probable' where id=fixture_id(4);
 assert (select status='confirmed' from public.participant_group_assignments where id=fixture_id(4)), 'old-client probable not normalized';
 begin
  update public.participant_group_assignments set status='rejected' where id=fixture_id(4);
  raise exception 'current rejected accepted';
 exception when check_violation then null;
 end;
end $$;

-- An audit storage failure must roll back the removal too.
create function app.fail_test_audit() returns trigger language plpgsql as $$ begin raise exception 'synthetic audit failure'; end $$;
create trigger fail_test_audit before insert on public.audit_logs for each row execute function app.fail_test_audit();
do $$ begin
 begin
  perform public.reject_group_assignment(fixture_id(4),fixture_id(300));
  raise exception 'expected audit failure';
 exception when raise_exception then
  assert sqlerrm='synthetic audit failure', 'unexpected exception';
 end;
 assert (select is_current from public.participant_group_assignments where id=fixture_id(4)), 'audit failure left partial removal';
end $$;
