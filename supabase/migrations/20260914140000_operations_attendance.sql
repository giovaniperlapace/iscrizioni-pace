-- Admin/global and manager/event attendance edits, including ungrouped registrations.
-- Atomic replacement and audit; existing leader RPC, RLS and snapshots are unchanged.
begin;
create or replace function public.update_operations_attendance(
  p_registration_id uuid, p_actor_user_id uuid, p_unknown boolean, p_slots jsonb
) returns void language plpgsql security invoker set search_path = '' as $$
declare
  registration public.registrations%rowtype;
  event public.events%rowtype;
  slot jsonb;
  slot_day date;
begin
  -- Same registration lock used by soft delete and quick operations.
  select r.* into registration from public.registrations r
    where r.id = p_registration_id for update;
  if not found or registration.deleted_at is not null then
    raise exception 'Registration unavailable' using errcode = '42501';
  end if;
  if not exists (select 1 from public.event_user_roles
    where user_id = p_actor_user_id and
      ((role = 'admin' and event_id is null) or
       (role = 'manager' and event_id = registration.event_id))) then
    raise exception 'Registration outside scope' using errcode = '42501';
  end if;
  select * into event from public.events where id = registration.event_id;
  if not found then raise exception 'Event unavailable' using errcode = '42501'; end if;

  if p_unknown is null or p_slots is null or jsonb_typeof(p_slots) <> 'array' then
    raise exception 'Invalid attendance' using errcode = '22023';
  end if;
  if not p_unknown then
    if jsonb_array_length(p_slots) = 0 or event.starts_on is null
       or coalesce(event.ends_on, event.starts_on) < event.starts_on then
      raise exception 'Invalid attendance' using errcode = '22023';
    end if;
    for slot in select value from jsonb_array_elements(p_slots) loop
      if jsonb_typeof(slot) <> 'object' or (slot->>'day') is null
         or (slot->>'day') !~ '^\d{4}-\d{2}-\d{2}$'
         or (slot->>'part') is null or (slot->>'part') not in ('morning','afternoon') then
        raise exception 'Invalid attendance slot' using errcode = '22023';
      end if;
      slot_day := (slot->>'day')::date;
      if not (slot_day between event.starts_on and coalesce(event.ends_on, event.starts_on)
        or (slot_day = event.starts_on - 1 and slot->>'part' = 'afternoon')) then
        raise exception 'Attendance outside event dates' using errcode = '22023';
      end if;
    end loop;
  end if;

  delete from public.event_attendance_choices where registration_id = registration.id;
  if p_unknown then
    insert into public.event_attendance_choices(registration_id, choice) values(registration.id, 'unknown');
  else
    insert into public.event_attendance_choices(registration_id, day, day_part, choice)
      select distinct registration.id, (value->>'day')::date, value->>'part', 'yes'
      from jsonb_array_elements(p_slots);
  end if;
  insert into public.audit_logs(event_id, actor_user_id, action, entity_table, entity_id, metadata)
    values(registration.event_id, p_actor_user_id, 'participant.attendance_updated', 'registrations', registration.id,
      jsonb_build_object('changed_fields', jsonb_build_array('event_attendance_choices')));
end;
$$;
revoke all on function public.update_operations_attendance(uuid, uuid, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.update_operations_attendance(uuid, uuid, boolean, jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
