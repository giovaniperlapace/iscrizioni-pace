-- Explicit Admin-only transition. Installing this function does not open Forums.
begin;
create or replace function public.set_forum_bookings_open(
  p_event uuid, p_expected_mode text, p_open boolean
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  previous_mode text;
  next_mode text;
begin
  -- Lock the authorization too: a concurrent revocation cannot be bypassed.
  perform 1 from public.event_user_roles
    where user_id = auth.uid() and role = 'admin' and event_id is null
    for share;
  if not found then raise insufficient_privilege; end if;
  if p_open is null or p_expected_mode is null
    or p_expected_mode not in ('internal', 'catalog', 'open') then
    raise invalid_parameter_value;
  end if;
  select panel_access_mode into previous_mode from public.events
    where id = p_event and is_current and status = 'published' for update;
  if not found then raise exception 'Current published event required' using errcode = 'P0002'; end if;
  next_mode := case when p_open then 'open' else 'internal' end;
  -- Repeating a completed command is safe, without a duplicate audit.
  if previous_mode = next_mode then return previous_mode; end if;
  if previous_mode is distinct from p_expected_mode then
    raise exception 'Forum opening changed; refresh settings' using errcode = '40001';
  end if;
  update public.events set panel_access_mode = next_mode where id = p_event;
  insert into public.audit_logs(event_id, actor_user_id, action, entity_table, entity_id, metadata)
    values(p_event, auth.uid(), 'event.forum_opening_changed', 'events', p_event,
      jsonb_build_object('previous_mode', previous_mode, 'mode', next_mode));
  return next_mode;
end;
$$;
revoke all on function public.set_forum_bookings_open(uuid,text,boolean) from public, anon;
grant execute on function public.set_forum_bookings_open(uuid,text,boolean) to authenticated;
commit;
