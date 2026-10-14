-- Staging only. Requires the existing synthetic group-panel fixture.
-- All attendance changes and audit entries roll back at the end.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
create temporary table attendance_check_context on commit drop as
select a.id as assignment_id, r.id as registration_id, u.id as actor_id, e.starts_on
from public.participant_group_assignments a
join public.registrations r on r.id = a.registration_id
join public.participants p on p.id = r.participant_id
join public.groups g on g.id = a.group_id
join public.events e on e.id = r.event_id
cross join auth.users u
where g.name = 'Test iscrizioni panel' and p.last_name = 'Test Panel'
  and p.first_name = 'Anna' and a.is_current and r.deleted_at is null
  and e.is_current and e.starts_on is not null
  and u.email = 'capogruppo.panel.staging@example.invalid';
do $$ begin
  assert (select count(*) = 1 from attendance_check_context), 'Expected one synthetic registration';
  assert has_function_privilege('service_role', 'public.update_group_leader_attendance(uuid,uuid,boolean,jsonb)', 'EXECUTE');
  assert not has_function_privilege('anon', 'public.update_group_leader_attendance(uuid,uuid,boolean,jsonb)', 'EXECUTE');
  assert not has_function_privilege('authenticated', 'public.update_group_leader_attendance(uuid,uuid,boolean,jsonb)', 'EXECUTE');
end $$;
grant select on attendance_check_context to service_role;
set local role service_role;
do $$
declare
  c record;
  original_panels text;
  original_checkins text;
  audit_count bigint;
  slots jsonb;
begin
  select * into strict c from attendance_check_context;
  select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text, '[]')) into original_panels from public.moment_attendance_choices t;
  select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text, '[]')) into original_checkins from public.check_ins t;
  select count(*) into audit_count from public.audit_logs;
  slots := jsonb_build_array(
    jsonb_build_object('day', c.starts_on, 'part', 'morning'),
    jsonb_build_object('day', c.starts_on, 'part', 'afternoon'),
    jsonb_build_object('day', c.starts_on, 'part', 'morning')
  );
  perform public.update_group_leader_attendance(c.assignment_id, c.actor_id, false, slots);
  assert (select count(*) = 2 and bool_and(day = c.starts_on and choice = 'yes')
    from public.event_attendance_choices where registration_id = c.registration_id), 'Save/read or deduplication failed';
  assert (select count(*) = audit_count + 1 from public.audit_logs), 'Missing audit';
  begin
    perform public.update_group_leader_attendance(c.assignment_id, gen_random_uuid(), true, '[]');
    raise exception 'Out-of-scope actor accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.update_group_leader_attendance(c.assignment_id, c.actor_id, false, '[]');
    raise exception 'Empty known attendance accepted';
  exception when invalid_parameter_value then null;
  end;
  assert (select count(*) = 2 from public.event_attendance_choices where registration_id = c.registration_id), 'Rejected update changed attendance';
  assert (select count(*) = audit_count + 1 from public.audit_logs), 'Rejected update changed audit';
  perform public.update_group_leader_attendance(c.assignment_id, c.actor_id, true, '[]');
  assert (select count(*) = 1 and bool_and(choice = 'unknown' and day is null and day_part is null)
    from public.event_attendance_choices where registration_id = c.registration_id), 'Unknown attendance replacement failed';
  assert (select count(*) = audit_count + 2 from public.audit_logs), 'Missing replacement audit';
  assert (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text, '[]')) = original_panels from public.moment_attendance_choices t), 'Panel bookings changed';
  assert (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text, '[]')) = original_checkins from public.check_ins t), 'Check-ins changed';
end $$;
reset role;
select 'PASS staging attendance save/read, scope, validation, audit, unchanged panel bookings/check-ins';
rollback;
