begin;
create index if not exists audit_group_assignment_reports_idx
  on public.audit_logs(event_id, entity_id, actor_user_id)
  where action = 'group_leader.assignment_reported';
create or replace function public.report_group_assignment(
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
  where r.id = assignment.registration_id and e.is_current and r.deleted_at is null;
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

  -- The row lock makes repeat submissions idempotent without touching the assignment.
  if exists (select 1 from public.audit_logs where entity_id = assignment.id
    and action = 'group_leader.assignment_reported' and actor_user_id = p_actor_user_id)
  then return; end if;

  insert into public.audit_logs(event_id, actor_user_id, action, entity_table, entity_id, metadata)
  values (assignment_event_id, p_actor_user_id, 'group_leader.assignment_reported',
    'participant_group_assignments', assignment.id,
    jsonb_build_object('registration_id', assignment.registration_id,
      'group_id', assignment.group_id, 'assignment_unchanged', true));
end;
$$;
revoke all on function public.report_group_assignment(uuid, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.report_group_assignment(uuid, uuid, text, boolean) to service_role;

-- Keep stale clients safe: the old command now reports only.
create or replace function public.reject_group_assignment(
  p_assignment_id uuid, p_actor_user_id uuid,
  p_note text default null, p_update_note boolean default false
) returns void language sql security invoker set search_path = '' as $$
  select public.report_group_assignment(p_assignment_id, p_actor_user_id, p_note, p_update_note);
$$;
revoke all on function public.reject_group_assignment(uuid, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.reject_group_assignment(uuid, uuid, text, boolean) to service_role;

-- Leaders save notes through the scoped server action; direct assignment edits
-- are reserved to operational managers/admins.
drop policy "group assignments update manager or group leader" on public.participant_group_assignments;
create policy "group assignments update managers"
  on public.participant_group_assignments for update
  using (app.can_manage_registration(registration_id))
  with check (app.can_manage_registration(registration_id));

notify pgrst, 'reload schema';
commit;
