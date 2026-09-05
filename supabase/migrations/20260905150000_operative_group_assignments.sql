-- Current assignments are immediately operative. Historical decisions and audit
-- rows remain intact. Deploy the compatible application together with this SQL.
begin;

with previous as materialized (
  select a.id, a.registration_id, a.group_id, a.status as previous_status,
    a.assignment_reason as previous_reason, r.event_id,
    coalesce((a.status = 'rejected'
      or (a.status = 'probable' and a.source = 'rule')
      or (a.status = 'probable' and a.assignment_reason = 'group_leader_rejected_escalated_to_parent')
      or (p.participates_with_group = false and a.source not in ('admin', 'manager'))
    ), false) as remove_assignment
  from public.participant_group_assignments a
  join public.registrations r on r.id = a.registration_id
  join public.participants p on p.id = r.participant_id
  where a.is_current
), changed as (
  update public.participant_group_assignments a
  set is_current = not previous.remove_assignment,
      status = case when previous.remove_assignment then 'rejected'
                    else 'confirmed' end::public.group_assignment_status,
      updated_at = now()
  from previous
  where a.id = previous.id
    and (previous.remove_assignment or previous.previous_status = 'probable')
  returning a.id
)
insert into public.audit_logs(event_id, action, entity_table, entity_id, metadata)
select previous.event_id, 'participant.group_assignment_migrated',
  'participant_group_assignments', previous.id,
  jsonb_build_object(
    'registration_id', previous.registration_id,
    'group_id', previous.group_id,
    'previous_status', previous.previous_status,
    'previous_assignment_reason', previous.previous_reason,
    'moved_to_without_group', previous.remove_assignment,
    'reason', 'operative_assignments_2026_09_05'
  )
from changed join previous on previous.id = changed.id;

alter table public.participant_group_assignments alter column status set default 'confirmed';
drop index if exists public.participant_group_assignments_leader_review_idx;

-- Old clients may still submit probable during rollout; normalize at the write
-- boundary without fabricating a human confirmation or changing past decisions.
create or replace function app.normalize_current_group_assignment()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.is_current and new.status = 'probable' then
    new.status := 'confirmed';
  end if;
  return new;
end;
$$;
create trigger normalize_current_group_assignment
before insert or update on public.participant_group_assignments
for each row execute function app.normalize_current_group_assignment();
alter table public.participant_group_assignments
  add constraint current_group_assignment_is_operative
  check (not is_current or status = 'confirmed');

-- Only the server can call this RPC after authenticating the acting leader.
-- Scope is checked again here; removal and audit commit or roll back together.
create or replace function public.reject_group_assignment(
  p_assignment_id uuid, p_actor_user_id uuid,
  p_note text default null, p_update_note boolean default false
) returns void language plpgsql security invoker set search_path = '' as $$
declare
  assignment public.participant_group_assignments%rowtype;
  assignment_event_id uuid;
begin
  select * into assignment from public.participant_group_assignments
  where id = p_assignment_id and is_current for update;
  if not found then raise exception 'Assignment unavailable' using errcode = 'P0002'; end if;

  select r.event_id into assignment_event_id
  from public.registrations r join public.events e on e.id = r.event_id
  where r.id = assignment.registration_id and e.is_current;
  if assignment_event_id is null or not exists (
    with recursive scope as (
      select g.id from public.groups g
      join public.group_memberships m on m.group_id = g.id
      where m.user_id = p_actor_user_id and m.role = 'capogruppo'
        and g.event_id = assignment_event_id and g.is_active
      union
      select g.id from public.groups g join scope on g.parent_group_id = scope.id
      where g.event_id = assignment_event_id and g.is_active
    ) select 1 from scope where id = assignment.group_id
  ) then raise exception 'Assignment outside scope' using errcode = '42501'; end if;

  update public.participant_group_assignments
  set is_current = false, status = 'rejected',
      leader_decision_by = p_actor_user_id, leader_decision_at = now(),
      leader_internal_note = case when p_update_note then p_note else leader_internal_note end,
      leader_note_updated_by = case when p_update_note then p_actor_user_id else leader_note_updated_by end,
      leader_note_updated_at = case when p_update_note then now() else leader_note_updated_at end,
      updated_at = now()
  where id = assignment.id;

  insert into public.audit_logs(event_id, actor_user_id, action, entity_table, entity_id, metadata)
  values (assignment_event_id, p_actor_user_id, 'group_leader.assignment_rejected',
    'participant_group_assignments', assignment.id,
    jsonb_build_object('registration_id', assignment.registration_id,
      'group_id', assignment.group_id, 'previous_status', assignment.status,
      'note_changed', p_update_note, 'moved_to_without_group', true,
      'moved_to_external_queue', true, 'escalated_to_group_id', null));
end;
$$;
revoke all on function public.reject_group_assignment(uuid, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.reject_group_assignment(uuid, uuid, text, boolean) to service_role;

notify pgrst, 'reload schema';
commit;
