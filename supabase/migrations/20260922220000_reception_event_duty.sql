-- P12: explicit event reception duty. The existing accoglienza event role
-- remains an EVENT-entry grant, never a generic grant for future panel staff.
-- P13 must assign panel/room duties separately without granting this role.
begin;
create function public.reception_event_check_in(
  p_duty text, p_event_id uuid, p_actor_user_id uuid, p_lookup_kind text, p_lookup text,
  p_action text default 'inspect', p_request_id uuid default null,
  p_subject_ids uuid[] default '{}', p_students integer default null,
  p_companions integer default null, p_expected_revision integer default null,
  p_reason text default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  if p_duty is distinct from 'event_entry' then
    raise insufficient_privilege using message='Reception duty forbidden';
  end if;
  -- P11 locks/checks the actual actor's event role and current event on EVERY
  -- call (including retries), before looking up a subject or returning data.
  return public.reception_check_in(p_event_id,p_actor_user_id,p_lookup_kind,p_lookup,
    p_action,p_request_id,p_subject_ids,p_students,p_companions,p_expected_revision,p_reason);
end $$;
revoke all on function public.reception_event_check_in(text,uuid,uuid,text,text,text,uuid,uuid[],integer,integer,integer,text) from public,anon,authenticated;
grant execute on function public.reception_event_check_in(text,uuid,uuid,text,text,text,uuid,uuid[],integer,integer,integer,text) to service_role;
comment on function public.reception_event_check_in(text,uuid,uuid,text,text,text,uuid,uuid[],integer,integer,integer,text)
  is 'Event entry only. No panel or room duty grants event entry. Server-supplied actor and current event are rechecked atomically by reception_check_in.';
notify pgrst, 'reload schema';
commit;
