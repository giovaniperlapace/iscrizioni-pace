-- Scoped edits/removal of an existing child; no historical rewrites or RLS changes.
begin;
create or replace function public.update_operational_child(
  p_child_id uuid, p_actor_user_id uuid, p_expected jsonb, p_child jsonb
) returns void language plpgsql security invoker set search_path = '' as $$
declare
  registration public.registrations%rowtype;
  child public.registration_children%rowtype;
  before_data jsonb;
  birthday date;
  new_first_name text;
  new_last_name text;
begin
  select r.* into registration from public.registrations r
    join public.registration_children c on c.registration_id = r.id
    where c.id = p_child_id for update of r;
  if not found or registration.deleted_at is not null then
    raise exception 'Registration unavailable' using errcode = '42501';
  end if;
  if not exists (select 1 from public.event_user_roles where user_id = p_actor_user_id
      and ((role = 'admin' and event_id is null) or (role = 'manager' and event_id = registration.event_id)))
    and not exists (
      with recursive scope as (
        select g.id from public.groups g
          join public.group_memberships m on m.group_id = g.id
          join public.events e on e.id = g.event_id
        where m.user_id = p_actor_user_id and m.role = 'capogruppo'
          and e.is_current and g.event_id = registration.event_id and g.is_active
        union
        select g.id from public.groups g join scope s on g.parent_group_id = s.id
          where g.event_id = registration.event_id and g.is_active
      ) select 1 from public.participant_group_assignments a join scope s on s.id = a.group_id
        where a.registration_id = registration.id and a.is_current
    ) then raise exception 'Registration outside scope' using errcode = '42501';
  end if;
  select * into child from public.registration_children where id = p_child_id and registration_id = registration.id for update;
  if not found then raise exception 'Child unavailable' using errcode = '42501'; end if;
  before_data := jsonb_build_object('first_name', child.first_name, 'last_name', child.last_name, 'birth_date', child.birth_date);
  if p_expected is distinct from before_data then
    raise exception 'Child changed; reload before saving' using errcode = '40001';
  end if;

  if p_child is null then
    delete from public.registration_children where id = child.id;
  else
    if jsonb_typeof(p_child) <> 'object' or jsonb_typeof(p_child->'first_name') is distinct from 'string'
       or jsonb_typeof(p_child->'last_name') is distinct from 'string'
       or jsonb_typeof(p_child->'birth_date') is distinct from 'string' then
      raise exception 'Invalid child' using errcode = '22023';
    end if;
    new_first_name := btrim(p_child->>'first_name'); new_last_name := btrim(p_child->>'last_name');
    if char_length(new_first_name) not between 1 and 120 or char_length(new_last_name) not between 1 and 120
       or (p_child->>'birth_date') !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'Invalid child' using errcode = '22023';
    end if;
    birthday := (p_child->>'birth_date')::date;
    if birthday > (now() at time zone 'UTC')::date then raise exception 'Future birth date' using errcode = '22023'; end if;
    update public.registration_children set first_name = new_first_name,
      last_name = new_last_name, birth_date = birthday where id = child.id;
  end if;
  insert into public.audit_logs(event_id, actor_user_id, action, entity_table, entity_id, metadata)
    values(registration.event_id, p_actor_user_id,
      case when p_child is null then 'registration_child.deleted' else 'registration_child.updated' end,
      'registration_children', child.id,
      jsonb_build_object('registration_id', registration.id, 'before', to_jsonb(child), 'after',
        (select to_jsonb(c) from public.registration_children c where c.id = child.id)));
end;
$$;
revoke all on function public.update_operational_child(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.update_operational_child(uuid, uuid, jsonb, jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
